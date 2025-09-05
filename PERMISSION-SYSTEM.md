# 🎯 **Advanced Permission System Documentation**

## **Overview**
The DeltaYards CRM now supports a comprehensive permission system with both **role-based** and **user-specific** permissions, allowing for fine-grained access control.

## **🏗️ System Architecture**

### **1. Role-Based Permissions (Global)**
- **Role Model**: Defines global permissions for each role
- **User Level**: Hierarchy system (1=superadmin, higher=lower privilege)
- **Inheritance**: Users inherit permissions from their assigned role

### **2. User-Specific Permissions (Overrides)**
- **Custom Permissions**: Additional or denied permissions per user
- **Project Restrictions**: Limit which projects a user can access
- **User Status**: Active/inactive status control

### **3. Project-Specific Permissions**
- **UserProjectPermission Model**: Project-specific permission overrides
- **Action Restrictions**: Control specific actions within projects
- **Assignment Tracking**: Track who assigned permissions and when

## **📊 Permission Hierarchy**

```
1. Superadmin (level 1) - ALL PERMISSIONS
2. Manager (level 2) - Role permissions + custom overrides
3. User (level 3+) - Role permissions + custom overrides + project restrictions
```

## **🔧 API Endpoints**

### **Permission Management (Superadmin Only)**

#### **Get User Permissions**
```http
GET /api/permissions/user/{userId}
Authorization: Bearer {superadmin_token}
```

#### **Update User Custom Permissions**
```http
PUT /api/permissions/user/{userId}/permissions
Authorization: Bearer {superadmin_token}
Content-Type: application/json

{
  "allowed": ["leads:create", "leads:update"],
  "denied": ["leads:delete"]
}
```

#### **Update User Restrictions**
```http
PUT /api/permissions/user/{userId}/restrictions
Authorization: Bearer {superadmin_token}
Content-Type: application/json

{
  "maxProjects": 5,
  "allowedProjects": ["project_id_1", "project_id_2"],
  "deniedProjects": ["project_id_3"]
}
```

#### **Set Project-Specific Permissions**
```http
PUT /api/permissions/user/{userId}/project/{projectId}
Authorization: Bearer {superadmin_token}
Content-Type: application/json

{
  "permissions": {
    "allowed": ["leads:create", "leads:update"],
    "denied": ["leads:delete"]
  },
  "restrictions": {
    "canCreateLeads": true,
    "canEditLeads": true,
    "canDeleteLeads": false,
    "canViewAllLeads": true,
    "canManageUsers": false,
    "canViewReports": true,
    "canExportData": false
  }
}
```

### **Permission Checking (All Users)**

#### **Check Current User Permissions**
```http
GET /api/permissions/my-permissions
Authorization: Bearer {user_token}
```

#### **Test Permission Access**
```http
GET /api/permissions/check/{permission}
Authorization: Bearer {user_token}
```

#### **Test Project-Specific Permission**
```http
GET /api/permissions/check/{permission}/project/{projectId}
Authorization: Bearer {user_token}
```

## **💡 Usage Examples**

### **Example 1: Create User with Custom Permissions**

```javascript
// 1. Create user with role
const user = await User.create({
  name: "John Doe",
  email: "john@company.com",
  role: "user",
  level: 3,
  customPermissions: {
    allowed: ["leads:create", "leads:update"],
    denied: ["leads:delete"]
  },
  restrictions: {
    maxProjects: 3,
    allowedProjects: ["project1", "project2"]
  }
});

// 2. Set project-specific permissions
await UserProjectPermission.create({
  user: user._id,
  project: "project1",
  permissions: {
    allowed: ["leads:create"],
    denied: ["leads:update"]
  },
  restrictions: {
    canCreateLeads: true,
    canEditLeads: false
  },
  assignedBy: superadminId
});
```

### **Example 2: Check User Permissions**

```javascript
// Check if user has permission
const hasPermission = await user.hasPermission("leads:create");
// Returns: true/false

// Check if user can access project
const canAccess = user.canAccessProject("project1");
// Returns: true/false

// Get all effective permissions
const permissions = await user.getEffectivePermissions();
// Returns: ["leads:create", "leads:update", ...]
```

### **Example 3: Middleware Usage**

```javascript
// In your route
app.get('/api/leads', 
  auth, 
  checkPermission('leads:read'), 
  getLeads
);

// Project-specific permission
app.get('/api/projects/:projectId/leads', 
  auth, 
  checkPermission('leads:read', { projectSpecific: true }), 
  getProjectLeads
);

// Action-specific check
app.post('/api/projects/:projectId/leads', 
  auth, 
  checkProjectAction('canCreateLeads'), 
  createLead
);
```

## **🔒 Permission Types**

### **Global Permissions**
- `role:manage` - Manage roles
- `projects:manage` - Manage projects
- `users:manage` - Manage users
- `leads:create` - Create leads
- `leads:read` - Read leads
- `leads:update` - Update leads
- `leads:delete` - Delete leads
- `notifications:read` - Read notifications
- `notifications:update` - Update notifications

### **Project-Specific Restrictions**
- `canCreateLeads` - Can create leads in this project
- `canEditLeads` - Can edit leads in this project
- `canDeleteLeads` - Can delete leads in this project
- `canViewAllLeads` - Can view all leads in this project
- `canManageUsers` - Can manage users in this project
- `canViewReports` - Can view reports for this project
- `canExportData` - Can export data from this project

## **🎯 Best Practices**

### **1. Permission Design**
- **Start with roles**: Define base permissions in roles
- **Use custom permissions sparingly**: Only for specific user needs
- **Document permissions**: Keep a clear list of all permissions
- **Test thoroughly**: Always test permission combinations

### **2. User Management**
- **Principle of least privilege**: Give minimum required permissions
- **Regular audits**: Review user permissions periodically
- **Clear documentation**: Document why specific permissions are granted

### **3. Project Management**
- **Project-specific overrides**: Use for special cases only
- **Expiration dates**: Set expiration for temporary permissions
- **Assignment tracking**: Always track who assigned permissions

## **🚀 Migration Guide**

### **For Existing Users**
1. **Add custom permissions field** (already done in User model)
2. **Set default values** for existing users
3. **Test permission system** with existing data
4. **Update frontend** to use new permission APIs

### **For New Features**
1. **Define permissions** in Role model
2. **Add permission checks** to routes
3. **Test with different user types**
4. **Document new permissions**

## **🔍 Troubleshooting**

### **Common Issues**

#### **"Access denied" errors**
- Check if user has required permission
- Verify project access restrictions
- Check if user is active

#### **Permission not working**
- Ensure permission is defined in role
- Check for denied permissions
- Verify project-specific overrides

#### **Project access denied**
- Check allowedProjects restriction
- Verify deniedProjects list
- Ensure user is assigned to project

### **Debug Commands**

```javascript
// Get user's effective permissions
const permissions = await user.getEffectivePermissions();
console.log('User permissions:', permissions);

// Check specific permission
const hasPerm = await user.hasPermission('leads:create');
console.log('Has leads:create:', hasPerm);

// Check project access
const canAccess = user.canAccessProject('projectId');
console.log('Can access project:', canAccess);
```

## **📈 Future Enhancements**

1. **Permission Groups**: Group related permissions
2. **Time-based Permissions**: Temporary permissions with expiration
3. **Audit Logging**: Track all permission changes
4. **Permission Templates**: Predefined permission sets
5. **Bulk Operations**: Manage multiple users' permissions at once

---

**🎉 The permission system is now ready for use! Test it with different user types and permission combinations to ensure it meets your requirements.**
