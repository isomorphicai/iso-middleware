const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  roleName: { type: String, required: true },
  allowedMenus: [{ type: String }]
});

RolePermissionSchema.index({ tenantId: 1, roleName: 1 }, { unique: true });

const RolePermission = mongoose.models.RolePermission || mongoose.model('RolePermission', RolePermissionSchema);
module.exports = RolePermission;
