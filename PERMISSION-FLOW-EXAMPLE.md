# Permission Flow Example

## How the New Permission System Works

### 1. **User Creation Flow**
When a user is created, they get a role:

```json
{
  "_id": "68c940c66da2b9aeba1b008b",
  "name": "John Manager",
  "email": "john@example.com",
  "role": "manager",
  "level": 2,
  "customPermissions": {
    "allowed": [], // Empty - will be filled with role permissions
    "denied": []   // Empty - user-specific denied permissions
  }
}
```

### 2. **Role Permissions Automatically Show in Allowed**
When you get the user, role permissions automatically appear in `customPermissions.allowed`:

```json
{
  "user": {
    "_id": "68c940c66da2b9aeba1b008b",
    "name": "John Manager",
    "email": "john@example.com",
    "role": "manager",
    "level": 2,
    "customPermissions": {
      "allowed": [
        // ROLE PERMISSIONS (automatic from manager role)
        "leads:create",
        "leads:read",
        "leads:update",
        "projects:read",
        "projects:update",
        "users:read"
      ],
      "denied": [] // User-specific denied permissions
    }
  }
}
```

### 3. **Add User-Specific Denied Permissions**
To deny specific permissions to this user:

```bash
PUT /api/superadmin/users/68c940c66da2b9aeba1b008b/permissions
```

**Request Body:**
```json
{
  "denied": ["leads:delete", "users:manage"]
}
```

**Response:**
```json
{
  "user": {
    "_id": "68c940c66da2b9aeba1b008b",
    "name": "John Manager",
    "email": "john@example.com",
    "role": "manager",
    "level": 2,
    "customPermissions": {
      "allowed": [
        // ROLE PERMISSIONS (automatic)
        "leads:create",
        "leads:read",
        "leads:update",
        "projects:read",
        "projects:update",
        "users:read"
      ],
      "denied": [
        // USER-SPECIFIC DENIED PERMISSIONS
        "leads:delete",
        "users:manage"
      ]
    }
  },
  "summary": {
    "rolePermissionsCount": 6,
    "totalDenied": 2
  }
}
```

### 4. **Permission Resolution Logic**
- **Allowed permissions** = Role permissions (automatic)
- **Denied permissions** = User-specific overrides
- **Effective permissions** = Allowed - Denied

So John Manager can:
- ✅ Create leads (from role)
- ✅ Read leads (from role)  
- ✅ Update leads (from role)
- ❌ Delete leads (denied specifically)
- ✅ Read projects (from role)
- ✅ Update projects (from role)
- ✅ Read users (from role)
- ❌ Manage users (denied specifically)

## API Usage Examples

### Get User with Permissions
```bash
GET /api/superadmin/users/68c940c66da2b9aeba1b008b
```

### Update User's Denied Permissions
```bash
PUT /api/superadmin/users/68c940c66da2b9aeba1b008b/permissions
Content-Type: application/json

{
  "denied": ["leads:delete", "users:manage", "projects:delete"]
}
```

### Check if User Has Permission
```bash
POST /api/superadmin/users/68c940c66da2b9aeba1b008b/check-permission
Content-Type: application/json

{
  "permission": "leads:delete"
}
```

**Response:**
```json
{
  "user": { ... },
  "permission": "leads:delete",
  "hasPermission": false,
  "explanation": "User does not have \"leads:delete\" permission"
}
```

## Key Benefits

1. **Simple Flow**: Role → Allowed, User → Denied
2. **Automatic Role Permissions**: No need to manually add role permissions
3. **User-Specific Overrides**: Easy to deny specific permissions per user
4. **Clear Structure**: All permissions visible in one place
5. **Easy to Understand**: Role permissions are automatic, denied permissions are user-specific

