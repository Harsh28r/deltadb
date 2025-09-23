# Custom Permissions System Guide

## Overview

The custom permissions system allows you to grant or deny specific permissions to individual users beyond their role-based permissions. This provides fine-grained control over user access.

## How It Works

### Permission Hierarchy
1. **Role Permissions**: Base permissions from the user's assigned role
2. **Custom Allowed**: Additional permissions granted specifically to the user
3. **Custom Denied**: Permissions explicitly denied to the user (overrides role permissions)

### Permission Resolution Logic
1. If a permission is in `customPermissions.denied` → **DENIED** (regardless of role)
2. If a permission is in `customPermissions.allowed` → **ALLOWED**
3. If a permission is in role permissions → **ALLOWED**
4. Otherwise → **DENIED**

## API Endpoints

### 1. Update User Custom Permissions
**PUT** `/api/superadmin/users/:userId/custom-permissions`

Update both allowed and denied permissions for a user.

**Request Body:**
```json
{
  "allowed": ["leads:create", "leads:update", "custom:special-access"],
  "denied": ["leads:delete", "users:manage"]
}
```

**Response:**
```json
{
  "message": "User custom permissions updated successfully",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "manager",
    "level": 2
  },
  "customPermissions": {
    "allowed": ["leads:create", "leads:update", "custom:special-access"],
    "denied": ["leads:delete", "users:manage"]
  },
  "effectivePermissions": ["leads:create", "leads:update", "custom:special-access", "projects:read", ...],
  "summary": {
    "totalAllowed": 3,
    "totalDenied": 2,
    "totalEffective": 15
  }
}
```

### 2. Add Custom Permission
**POST** `/api/superadmin/users/:userId/custom-permissions/add`

Add a single permission to either allowed or denied list.

**Request Body:**
```json
{
  "permission": "leads:bulk-delete",
  "type": "allowed"  // or "denied"
}
```

**Response:**
```json
{
  "message": "Permission \"leads:bulk-delete\" added to allowed permissions",
  "user": { ... },
  "customPermissions": { ... },
  "effectivePermissions": [ ... ],
  "addedPermission": {
    "permission": "leads:bulk-delete",
    "type": "allowed"
  }
}
```

### 3. Remove Custom Permission
**POST** `/api/superadmin/users/:userId/custom-permissions/remove`

Remove a single permission from either allowed or denied list.

**Request Body:**
```json
{
  "permission": "leads:bulk-delete",
  "type": "allowed"  // or "denied"
}
```

### 4. Get User Effective Permissions
**GET** `/api/superadmin/users/:userId/effective-permissions`

Get all effective permissions for a user (role + custom allowed - custom denied).

**Response:**
```json
{
  "user": { ... },
  "rolePermissions": ["leads:read", "leads:update", "projects:read", ...],
  "customPermissions": {
    "allowed": ["leads:create", "custom:special-access"],
    "denied": ["leads:delete"]
  },
  "effectivePermissions": ["leads:read", "leads:update", "leads:create", "custom:special-access", "projects:read", ...],
  "summary": {
    "rolePermissionsCount": 10,
    "customAllowedCount": 2,
    "customDeniedCount": 1,
    "totalEffectiveCount": 11
  }
}
```

### 5. Check User Permission
**POST** `/api/superadmin/users/:userId/check-permission`

Check if a user has a specific permission.

**Request Body:**
```json
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

## Usage Examples

### Example 1: Grant Additional Permissions
```bash
# Add special access to a manager
curl -X POST /api/superadmin/users/64f1234567890abcdef12345/custom-permissions/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "permission": "users:manage",
    "type": "allowed"
  }'
```

### Example 2: Restrict Permissions
```bash
# Remove delete permission from a user
curl -X POST /api/superadmin/users/64f1234567890abcdef12345/custom-permissions/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "permission": "leads:delete",
    "type": "denied"
  }'
```

### Example 3: Bulk Update Permissions
```bash
# Set multiple custom permissions
curl -X PUT /api/superadmin/users/64f1234567890abcdef12345/custom-permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "allowed": ["leads:create", "leads:update", "custom:special-access"],
    "denied": ["leads:delete", "users:manage"]
  }'
```

### Example 4: Check Permission
```bash
# Check if user can delete leads
curl -X POST /api/superadmin/users/64f1234567890abcdef12345/check-permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "permission": "leads:delete"
  }'
```

## Important Notes

1. **Superadmin Protection**: Superadmin users cannot have their custom permissions modified
2. **Permission Normalization**: All permissions are automatically converted to lowercase and trimmed
3. **Conflict Resolution**: If a permission exists in both allowed and denied, denied takes precedence
4. **Role Override**: Custom denied permissions override role permissions
5. **Validation**: The system validates that permissions are properly formatted arrays

## Permission Categories

### Standard Permissions
- `leads:*` - Lead management permissions
- `projects:*` - Project management permissions
- `users:*` - User management permissions
- `role:*` - Role management permissions
- `notifications:*` - Notification permissions
- `reporting:*` - Reporting permissions

### Custom Permissions
You can create custom permissions with any naming convention:
- `custom:special-access`
- `feature:advanced-analytics`
- `module:inventory-management`

## Best Practices

1. **Use Denied Sparingly**: Only deny permissions when necessary for security
2. **Document Custom Permissions**: Keep track of what custom permissions mean
3. **Regular Audits**: Periodically review user permissions
4. **Test Changes**: Always test permission changes in a safe environment
5. **Role-First Approach**: Prefer role-based permissions over custom permissions when possible

## Error Handling

The API returns appropriate HTTP status codes:
- `400` - Bad Request (invalid input)
- `403` - Forbidden (trying to modify superadmin)
- `404` - Not Found (user not found)
- `500` - Internal Server Error

All errors include descriptive messages to help with debugging.
