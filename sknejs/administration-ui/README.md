####User Management
Create a new user for the Admin using the script generateUser with the following command:
```
npm run generateUser -- --userName=admin --password=123456 --email=admin@admin.com
```
Scan the QR code with an authenticator app to generate Two-Factor codes

### acl permissions:

Use the acl scripts to add roles to a user and allow permissions to a given role

Add roles to a user

```
npm run acl:role -- --username=admin --fn=addUserRoles admin
```

Add permission to a role
```
npm run acl:resource -- --role=admin --resource=bots --fn=allow view
```