const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, RolePermission, Tenant } = require('../models');

class AuthController {
  // Helper: Verify password with bcrypt or plaintext fallback
  verifyPassword(provided, stored) {
    if (!provided || !stored) return false;
    try {
      if (bcrypt.compareSync(provided, stored)) return true;
    } catch (e) {
      // not a valid bcrypt hash
    }
    return provided === stored;
  }

  // ==========================================
  // AUTH
  // ==========================================
  async login(req, res, next) {
    try {
      const { username, password, tenantId } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      const userRegex = new RegExp(`^${cleanUsername}$`, 'i');

      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      let authenticatedUser = null;
      let targetTenantName = null;

      // Helper: Verify password with bcrypt or plaintext fallback
      const checkPass = (stored) => {
        if (!stored) return false;
        try {
          if (bcrypt.compareSync(cleanPassword, stored)) return true;
        } catch (e) {}
        return cleanPassword === stored;
      };

      // 1. Check master > users collection (Primary user store in Atlas)
      const masterUser = await masterDb.collection('users').findOne({ 
        $or: [{ username: cleanUsername }, { username: userRegex }] 
      });
      if (masterUser && checkPass(masterUser.password)) {
        authenticatedUser = {
          username: masterUser.username,
          role: masterUser.role || 'global_admin',
          tenantId: masterUser.tenantId || null,
          fullName: masterUser.fullName || masterUser.username,
          email: masterUser.email || `${masterUser.username}@isomorphic.com`,
          phone: masterUser.phone || '',
          photo: masterUser.photo || ''
        };
      }

      // 2. Check default User collection if not found
      if (!authenticatedUser) {
        let user = await User.findOne({ 
          $or: [{ username: cleanUsername }, { username: userRegex }] 
        });
        if (user && checkPass(user.password)) {
          authenticatedUser = {
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
            fullName: user.fullName || user.username,
            email: user.email || `${user.username}@isomorphic.com`,
            phone: user.phone || '',
            photo: user.photo || ''
          };
        }
      }

      // 3. Check tenant-specific databases (iso_<tenantId> > users)
      if (!authenticatedUser) {
        const allTenants = await masterDb.collection('tenantInfo').find({}).toArray();
        for (const t of allTenants) {
          try {
            const tDb = mongoose.connection.useDb(t.tenantDbName || `iso_${t.tenantId}`, { useCache: true });
            const tUser = await tDb.collection('users').findOne({ 
              $or: [{ username: cleanUsername }, { username: userRegex }] 
            });
            if (tUser && checkPass(tUser.password)) {
              authenticatedUser = {
                username: tUser.username,
                role: tUser.role || 'tenant_admin',
                tenantId: t.tenantId || t._id?.toString(),
                tenantName: t.name || t.tenantName,
                fullName: tUser.fullName || tUser.username,
                email: tUser.email || `${tUser.username}@${t.tenantId}.com`,
                phone: '',
                photo: ''
              };
              targetTenantName = t.name || t.tenantName;
              break;
            }
          } catch (e) {
            // continue checking
          }
        }
      }

      // 4. Default fallback for standard demo admin
      if (!authenticatedUser) {
        if (cleanUsername.toLowerCase() === 'admin' && (cleanPassword === 'admin123' || cleanPassword === 'password' || cleanPassword === 'password123' || cleanPassword === 'admin')) {
          authenticatedUser = {
            username: 'admin',
            role: 'global_admin',
            tenantId: null,
            tenantName: null,
            fullName: 'Super Administrator',
            email: 'admin@isomorphic.com',
            phone: '',
            photo: ''
          };
        }
      }

      if (!authenticatedUser) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      // Resolve allowedMenus dynamically from master > roles and master > menus
      let allowedMenus = [];
      const roleQuery = authenticatedUser.role?.toLowerCase()?.replace(/\s+/g, '_');
      const roleDoc = await masterDb.collection('roles').findOne({
        $or: [
          { roleId: authenticatedUser.role },
          { roleName: authenticatedUser.role },
          { roleId: roleQuery }
        ]
      });

      if (roleDoc && Array.isArray(roleDoc.allowedMenus) && roleDoc.allowedMenus.length > 0) {
        allowedMenus = roleDoc.allowedMenus;
      } else if (authenticatedUser.role === 'Super Admin' || authenticatedUser.role === 'super_admin' || !authenticatedUser.tenantId) {
        const activeMenus = await masterDb.collection('menus').find({ active: true }).sort({ sortOrder: 1 }).toArray();
        allowedMenus = activeMenus.length > 0 ? activeMenus.map(m => m.menuId) : ['tenants', 'analytics', 'ingestion'];
      } else {
        allowedMenus = ['analytics', 'ingestion'];
      }

      if (authenticatedUser.tenantId && !targetTenantName) {
        const t = await Tenant.findById(authenticatedUser.tenantId);
        if (t) targetTenantName = t.name || t.tenantName;
      }

      // Return sanitized user profile WITHOUT password
      return res.json({
        username: authenticatedUser.username,
        role: authenticatedUser.role,
        tenantId: authenticatedUser.tenantId,
        tenantName: targetTenantName || authenticatedUser.tenantName,
        fullName: authenticatedUser.fullName || 'System Administrator',
        email: authenticatedUser.email || `${authenticatedUser.username}@isomorphic.com`,
        phone: authenticatedUser.phone || '',
        photo: authenticatedUser.photo || '',
        allowedMenus
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // USERS
  // ==========================================
  async getUsers(req, res, next) {
    try {
      const { tenantId } = req.query;
      const filter = {};
      if (tenantId) filter.tenantId = tenantId;
      
      const users = await User.find(filter, { 
        password: 0, 
        username: 1, role: 1, tenantId: 1, 
        fullName: 1, email: 1, phone: 1, photo: 1, createdAt: 1 
      }).sort({ createdAt: -1 });
      
      return res.json(users);
    } catch (err) {
      next(err);
    }
  }

  async createUser(req, res, next) {
    try {
      const { username, password, role, tenantId, fullName, email, phone } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required.' });
      }
      const existing = await User.findOne({ username });
      if (existing) {
        return res.status(400).json({ error: 'Username already taken.' });
      }

      const hashedPassword = bcrypt.hashSync(password.trim(), 10);
      const user = await User.create({
        username: username.trim(),
        password: hashedPassword,
        role,
        tenantId: tenantId || null,
        fullName: fullName || '',
        email: email || '',
        phone: phone || ''
      });

      const resUser = user.toObject();
      delete resUser.password;
      return res.status(201).json(resUser);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { password, role, fullName, email, phone, photo } = req.body;
      
      const updateData = {};
      if (password && password.trim()) updateData.password = bcrypt.hashSync(password.trim(), 10);
      if (role) updateData.role = role;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (photo !== undefined) updateData.photo = photo;

      const user = await User.findByIdAndUpdate(id, updateData, { new: true, select: '-password' });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      
      return res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const user = await User.findByIdAndDelete(id);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      return res.json({ success: true, message: 'User deleted.' });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ROLES & PERMISSIONS
  // ==========================================
  async getRoles(req, res, next) {
    try {
      const { tenantId } = req.query;
      const filter = {};
      if (tenantId) filter.tenantId = tenantId;
      const roles = await RolePermission.find(filter);
      return res.json(roles);
    } catch (err) {
      next(err);
    }
  }

  async saveRole(req, res, next) {
    try {
      const { tenantId, roleName, allowedMenus } = req.body;
      if (!roleName) return res.status(400).json({ error: 'Role name is required.' });

      let role = await RolePermission.findOne({ tenantId, roleName });
      if (role) {
        role.allowedMenus = allowedMenus;
        await role.save();
      } else {
        role = await RolePermission.create({ tenantId, roleName, allowedMenus });
      }
      return res.json(role);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
