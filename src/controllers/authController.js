const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, RolePermission, Tenant } = require('../models');
const logger = require('../helpers/logger');

// Inactivity timeout: 2 Hours (7200000 milliseconds)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

class AuthController {
  constructor() {
    this.indexEnsured = false;
  }

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

  // Helper: Get master database instance
  getMasterDb() {
    return mongoose.connection.useDb('master', { useCache: true });
  }

  // Helper: Get master > sessionManagement collection & ensure TTL index
  getSessionCollection() {
    const col = this.getMasterDb().collection('sessionManagement');
    if (!this.indexEnsured && mongoose.connection.readyState === 1) {
      col.createIndex({ lastActivityTime: 1 }, { expireAfterSeconds: 7200, background: true }).catch(() => {});
      this.indexEnsured = true;
    }
    return col;
  }

  // Helper: Generate secure unique session ID
  generateSessionId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return crypto.randomBytes(24).toString('hex');
  }

  // Helper: Resolve dynamic allowed menus for user/role
  async resolveAllowedMenus(userRole, tenantId) {
    try {
      const masterDb = this.getMasterDb();
      let allowedMenus = [];
      const roleQuery = (userRole || '').toLowerCase().replace(/\s+/g, '_');
      
      const roleDoc = await masterDb.collection('roles').findOne({
        $or: [
          { roleId: userRole },
          { roleName: userRole },
          { roleId: roleQuery }
        ]
      });

      if (roleDoc && Array.isArray(roleDoc.allowedMenus) && roleDoc.allowedMenus.length > 0) {
        allowedMenus = roleDoc.allowedMenus;
      } else if (userRole === 'Super Admin' || userRole === 'super_admin' || userRole === 'global_admin' || !tenantId) {
        const activeMenus = await masterDb.collection('menus').find({ active: true }).sort({ sortOrder: 1 }).toArray();
        allowedMenus = activeMenus.length > 0 ? activeMenus.map(m => m.menuId) : ['tenants', 'analytics', 'ingestion', 'conversations', 'chat'];
      } else {
        allowedMenus = ['analytics', 'ingestion', 'chat'];
      }
      return allowedMenus;
    } catch (err) {
      logger.error(`Error resolving allowed menus: ${err.message}`);
      return ['tenants', 'analytics', 'ingestion', 'conversations', 'chat'];
    }
  }

  // Helper: Resolve allowed analytics widgets for user/role
  async resolveAllowedWidgets(userRole, tenantId) {
    const ALL_WIDGET_IDS = [
      'total_questions', 'total_sessions', 'avg_questions_day', 'avg_questions_session',
      'avg_session_length', 'csat_score', 'thumbs_up_score', 'avg_latency', 'token_usage',
      'daily_trend_chart', 'top_intents_chart', 'sentiment_donut_chart', 'hourly_heatmap_chart',
      'csat_breakdown_chart', 'top_queries_table', 'recent_sessions_table'
    ];

    try {
      if (userRole === 'Super Admin' || userRole === 'super_admin' || userRole === 'global_admin' || !tenantId) {
        return ALL_WIDGET_IDS;
      }

      const masterDb = this.getMasterDb();
      const roleQuery = (userRole || '').toLowerCase().replace(/\s+/g, '_');
      const roleDoc = await masterDb.collection('roles').findOne({
        $or: [
          { roleId: userRole },
          { roleName: userRole },
          { roleId: roleQuery }
        ]
      });

      if (roleDoc && Array.isArray(roleDoc.allowedWidgets) && roleDoc.allowedWidgets.length > 0) {
        return roleDoc.allowedWidgets;
      }

      return ALL_WIDGET_IDS;
    } catch (err) {
      logger.error(`Error resolving allowed widgets: ${err.message}`);
      return ALL_WIDGET_IDS;
    }
  }


  // ==========================================
  // AUTH: LOGIN & SESSION CREATION
  // ==========================================
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      const userRegex = new RegExp(`^${cleanUsername}$`, 'i');

      const masterDb = this.getMasterDb();
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

      // Resolve allowed menus & analytics widgets dynamically
      const allowedMenus = await this.resolveAllowedMenus(authenticatedUser.role, authenticatedUser.tenantId);
      const allowedWidgets = await this.resolveAllowedWidgets(authenticatedUser.role, authenticatedUser.tenantId);

      if (authenticatedUser.tenantId && !targetTenantName) {
        const t = await Tenant.findById(authenticatedUser.tenantId);
        if (t) targetTenantName = t.name || t.tenantName;
      }

      // Generate a new unique session ID
      const sessionId = this.generateSessionId();
      const now = new Date();

      // Store session in MongoDB Atlas master > sessionManagement
      const sessionCol = this.getSessionCollection();
      const sessionDoc = {
        sessionId,
        username: authenticatedUser.username,
        tenantId: authenticatedUser.tenantId || null,
        tenantName: targetTenantName || authenticatedUser.tenantName || null,
        role: authenticatedUser.role || 'global_admin',
        fullName: authenticatedUser.fullName || authenticatedUser.username,
        email: authenticatedUser.email || `${authenticatedUser.username}@isomorphic.com`,
        loginTime: now,
        lastActivityTime: now,
        isActive: true,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: now,
        updatedAt: now
      };

      await sessionCol.insertOne(sessionDoc);
      logger.info(`Session created for user "${authenticatedUser.username}" (sessionId: ${sessionId}) in master.sessionManagement`);

      // Return sanitized user profile WITH sessionId and allowedWidgets
      return res.json({
        sessionId,
        username: authenticatedUser.username,
        role: authenticatedUser.role,
        tenantId: authenticatedUser.tenantId,
        tenantName: targetTenantName || authenticatedUser.tenantName,
        fullName: authenticatedUser.fullName || 'System Administrator',
        email: authenticatedUser.email || `${authenticatedUser.username}@isomorphic.com`,
        phone: authenticatedUser.phone || '',
        photo: authenticatedUser.photo || '',
        allowedMenus,
        allowedWidgets,
        loginTime: now,
        lastActivityTime: now
      });
    } catch (err) {
      logger.error(`Login error: ${err.message}`);
      next(err);
    }
  }

  // ==========================================
  // AUTH: SESSION VERIFICATION & AUTO-EXPIRY (2 HOURS INACTIVITY)
  // ==========================================
  async verifySession(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'] || 
        req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
        req.body?.sessionId || 
        req.query?.sessionId;

      if (!sessionId) {
        return res.status(401).json({ error: 'No active session token provided.', active: false });
      }

      const sessionCol = this.getSessionCollection();
      const session = await sessionCol.findOne({ sessionId });

      if (!session || !session.isActive) {
        return res.status(401).json({ 
          error: 'Session is invalid or does not exist.', 
          active: false 
        });
      }

      const now = Date.now();
      const lastActive = new Date(session.lastActivityTime || session.loginTime || session.createdAt).getTime();
      const inactiveDuration = now - lastActive;

      // Check if session has exceeded the 2-hour inactivity limit -> Delete immediately
      if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
        await sessionCol.deleteOne({ sessionId });
        logger.info(`Session deleted due to 2h inactivity for user "${session.username}" (sessionId: ${sessionId})`);
        return res.status(401).json({ 
          error: 'Session expired due to 2 hours of inactivity. Please log in again.', 
          active: false, 
          reason: 'inactivity' 
        });
      }

      // Update lastActivityTime to current time
      const currentDate = new Date();
      await sessionCol.updateOne(
        { sessionId },
        { 
          $set: { 
            lastActivityTime: currentDate, 
            updatedAt: currentDate 
          } 
        }
      );

      // Re-fetch master user record to get any updated full name / photo / phone
      const masterDb = this.getMasterDb();
      const masterUser = await masterDb.collection('users').findOne({ username: session.username });

      // Refresh allowed menus & analytics widgets dynamically
      const allowedMenus = await this.resolveAllowedMenus(session.role, session.tenantId);
      const allowedWidgets = await this.resolveAllowedWidgets(session.role, session.tenantId);

      return res.json({
        active: true,
        sessionId: session.sessionId,
        user: {
          sessionId: session.sessionId,
          username: session.username,
          role: session.role,
          tenantId: session.tenantId,
          tenantName: session.tenantName,
          fullName: masterUser?.fullName || session.fullName || session.username,
          email: masterUser?.email || session.email || `${session.username}@isomorphic.com`,
          phone: masterUser?.phone || '',
          photo: masterUser?.photo || '',
          allowedMenus,
          allowedWidgets,
          loginTime: session.loginTime,
          lastActivityTime: currentDate
        }
      });
    } catch (err) {
      logger.error(`Session verification error: ${err.message}`);
      next(err);
    }
  }

  // ==========================================
  // AUTH: HEARTBEAT (REFRESH LAST ACTIVITY)
  // ==========================================
  async heartbeat(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'] || 
        req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
        req.body?.sessionId || 
        req.query?.sessionId;

      if (!sessionId) {
        return res.status(401).json({ active: false, error: 'Session ID required.' });
      }

      const sessionCol = this.getSessionCollection();
      const session = await sessionCol.findOne({ sessionId });

      if (!session || !session.isActive) {
        return res.status(401).json({ active: false, error: 'Session is inactive.' });
      }

      const now = Date.now();
      const lastActive = new Date(session.lastActivityTime || session.loginTime || session.createdAt).getTime();

      // Check inactivity limit -> Delete immediately if timed out
      if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
        await sessionCol.deleteOne({ sessionId });
        return res.status(401).json({ active: false, reason: 'inactivity', error: 'Session timed out.' });
      }

      // Update activity timestamp
      const currentDate = new Date();
      await sessionCol.updateOne(
        { sessionId },
        { 
          $set: { 
            lastActivityTime: currentDate, 
            updatedAt: currentDate 
          } 
        }
      );

      return res.json({ success: true, active: true, lastActivityTime: currentDate });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // AUTH: LOGOUT (IMMEDIATE SESSION DELETION)
  // ==========================================
  async logout(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'] || 
        req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
        req.body?.sessionId || 
        req.query?.sessionId;

      if (sessionId) {
        const sessionCol = this.getSessionCollection();
        await sessionCol.deleteOne({ sessionId });
        logger.info(`Session immediately deleted on logout for sessionId: ${sessionId}`);
      }

      return res.json({ success: true, message: 'Logged out and session deleted successfully.' });
    } catch (err) {
      logger.error(`Logout error: ${err.message}`);
      next(err);
    }
  }

  // ==========================================
  // SESSIONS MANAGEMENT (ACTIVE SESSIONS LIST)
  // ==========================================
  async getSessions(req, res, next) {
    try {
      const { tenantId, username } = req.query;
      const filter = { isActive: true };
      if (tenantId) filter.tenantId = tenantId;
      if (username) filter.username = username;

      const sessionCol = this.getSessionCollection();
      const sessions = await sessionCol.find(filter).sort({ loginTime: -1 }).limit(100).toArray();
      return res.json(sessions);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // USERS CRUD
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

  async createOrUpdateRole(req, res, next) {
    return this.saveRole(req, res, next);
  }

  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const role = await RolePermission.findByIdAndDelete(id);
      if (!role) return res.status(404).json({ error: 'Role not found.' });
      return res.json({ success: true, message: 'Role deleted.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
