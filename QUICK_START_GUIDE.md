# Quick Start Guide - Live Attendance System

## ✅ System is Ready!

All modules have been successfully installed and configured. Here's how to get started:

---

## 1. Start the Server

```bash
cd C:\Users\harshgupta\Documents\Crmbackend\deltadb
npm start
```

Or with nodemon:
```bash
nodemon server.js
```

The server should start without errors and show:
```
✅ Real-time system initialized
MongoDB connected successfully
🚀 Server running on port 5000
```

---

## 2. Test the Endpoints

### Option A: Quick Test with Existing Endpoints (No Selfie Required)

```bash
# Login first to get token
curl -X POST http://localhost:5000/api/superadmin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@deltayards.com",
    "password": "your-password"
  }'

# Save the token from response, then test regular check-in
curl -X POST http://localhost:5000/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "latitude": 28.7041,
    "longitude": 77.1025,
    "address": "Test Location",
    "accuracy": 10.5
  }'
```

### Option B: Test Live Check-In with Selfie

```bash
# Create a test image (or use any JPG/PNG file)
# Then test live check-in
curl -X POST http://localhost:5000/api/attendance/check-in-live \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "latitude=28.7041" \
  -F "longitude=77.1025" \
  -F "accuracy=10.5" \
  -F "selfie=@path/to/your/selfie.jpg" \
  -F "notes=Testing live check-in" \
  -F "platform=web"
```

---

## 3. Available Endpoints

### Regular Endpoints (No Selfie):
- `POST /api/attendance/check-in` - Basic check-in with location
- `POST /api/attendance/check-out` - Basic check-out
- `GET /api/attendance/status` - Get current status
- `GET /api/attendance/my-history` - Get your attendance history

### Live Endpoints (With Selfie + Auto-Geocoding):
- `POST /api/attendance/check-in-live` - Live check-in with selfie
- `POST /api/attendance/check-out-live` - Live check-out with selfie
- `POST /api/attendance/verify-location` - Check geofence
- `GET /api/attendance/selfie/:filename` - Get selfie image

### Superadmin Endpoints:
- `GET /api/attendance/admin/live` - Live dashboard
- `GET /api/attendance/admin/all` - All attendance records
- `GET /api/attendance/admin/user/:userId` - User details
- `GET /api/attendance/admin/stats` - Statistics
- `GET /api/attendance/admin/location-history/:userId` - Location tracking

---

## 4. Test with Web Interface

Create a simple HTML file (`test-attendance.html`):

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Attendance</title>
</head>
<body>
  <h1>Test Attendance Check-In</h1>

  <input type="text" id="token" placeholder="Enter your auth token" style="width: 400px;">
  <br><br>

  <button onclick="testBasicCheckIn()">Test Basic Check-In</button>
  <button onclick="testStatus()">Get Status</button>

  <pre id="result"></pre>

  <script>
    const API_URL = 'http://localhost:5000/api';

    async function testBasicCheckIn() {
      const token = document.getElementById('token').value;

      try {
        const response = await fetch(`${API_URL}/attendance/check-in`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            latitude: 28.7041,
            longitude: 77.1025,
            address: 'Test Location',
            accuracy: 10.5,
            notes: 'Test check-in from web'
          })
        });

        const data = await response.json();
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);

        if (response.ok) {
          alert('✅ Check-in successful!');
        } else {
          alert('❌ Error: ' + data.message);
        }
      } catch (error) {
        alert('❌ Network error: ' + error.message);
        console.error(error);
      }
    }

    async function testStatus() {
      const token = document.getElementById('token').value;

      try {
        const response = await fetch(`${API_URL}/attendance/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        alert('❌ Error: ' + error.message);
        console.error(error);
      }
    }
  </script>
</body>
</html>
```

Open this file in a browser and test!

---

## 5. Environment Variables (Optional)

Add to your `.env` file:

```env
# Optional: Google Maps API Key for better geocoding
GOOGLE_MAPS_API_KEY=your_api_key_here

# Optional: Office location for geofencing
OFFICE_LATITUDE=28.7041
OFFICE_LONGITUDE=77.1025
OFFICE_RADIUS_METERS=200

# Required: JWT Secret (should already be set)
JWT_SECRET=your_jwt_secret

# Required: MongoDB (should already be set)
MONGO_URI=your_mongodb_uri
```

**Note:** If you don't set `GOOGLE_MAPS_API_KEY`, the system will automatically use OpenStreetMap (free) for geocoding!

---

## 6. Accessing Selfie Images

Selfies are stored in: `C:\Users\harshgupta\Documents\Crmbackend\deltadb\uploads\attendance\selfies\`

Access via:
- Direct URL: `http://localhost:5000/uploads/attendance/selfies/filename.jpg`
- API Endpoint: `http://localhost:5000/api/attendance/selfie/filename.jpg`

Both require authentication token.

---

## 7. Verify Everything Works

Run this complete test:

```bash
# 1. Check server health
curl http://localhost:5000/api/health

# Expected: {"status":"ok","database":{"connected":true,...}}

# 2. Login
curl -X POST http://localhost:5000/api/superadmin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"password"}'

# Save the token from response

# 3. Check attendance status
curl -X GET http://localhost:5000/api/attendance/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: {"status":"not-checked-in",...}

# 4. Basic check-in
curl -X POST http://localhost:5000/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "latitude": 28.7041,
    "longitude": 77.1025,
    "accuracy": 10
  }'

# Expected: {"message":"Checked in successfully",...}
```

---

## 8. Common Issues & Solutions

### Issue: "No token, authorization denied"
**Solution:** Make sure you're including the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Issue: "Location coordinates are required"
**Solution:** The improved error message now shows what was received. Check that:
- Content-Type is `application/json` for regular endpoints
- For live endpoints, use `multipart/form-data`

### Issue: "Selfie image is required for check-in"
**Solution:** This is for `/check-in-live` endpoint only. Either:
- Use regular `/check-in` endpoint (no selfie required)
- Or upload a selfie file with the request

### Issue: Geocoding not working
**Solution:**
- No problem! System falls back to showing coordinates
- For better results, add Google Maps API key to .env
- OpenStreetMap fallback works automatically (free)

### Issue: Upload folder doesn't exist
**Solution:** The system creates it automatically on first upload. If issues persist:
```bash
mkdir -p uploads/attendance/selfies
```

---

## 9. Next Steps

1. **For Web App:** Use the complete HTML example in `LIVE_ATTENDANCE_INTEGRATION_GUIDE.md`

2. **For React:** Use the React component example with camera integration

3. **For Mobile:** Use the React Native example with expo-camera

4. **For Testing:** Use Postman or the simple HTML test file above

5. **For Production:**
   - Set up proper environment variables
   - Configure office geofencing
   - Add Google Maps API key for better geocoding
   - Set up image backup/storage

---

## 10. Features Summary

✅ **Basic Attendance** (No selfie required)
- JSON-based check-in/check-out
- GPS location tracking
- Manual address input
- Break management
- Work location tracking

✅ **Live Attendance** (With selfie)
- Live camera capture
- Auto-geocoding (coordinates → address)
- Geofencing verification
- Image storage and retrieval
- Device tracking

✅ **Superadmin Dashboard**
- Real-time monitoring
- Location history tracking
- Attendance reports
- User statistics
- Selfie verification

---

## 🎉 You're All Set!

Your attendance system is now fully functional with:
- ✅ Live selfie capture
- ✅ GPS location tracking
- ✅ Auto-geocoding
- ✅ Geofencing
- ✅ Full API documentation
- ✅ Frontend examples

Start the server and begin testing! 🚀
