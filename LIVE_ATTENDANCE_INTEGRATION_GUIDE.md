# Live Attendance Integration Guide
## Selfie Capture + GPS Location + Auto-Geocoding

This guide shows how to integrate the live attendance system with selfie capture, real-time GPS location tracking, and automatic address geocoding.

---

## Table of Contents
1. [API Endpoints](#api-endpoints)
2. [Web App Integration (HTML5/JavaScript)](#web-app-integration)
3. [React/Next.js Integration](#reactnextjs-integration)
4. [React Native Mobile App](#react-native-mobile-app)
5. [Environment Setup](#environment-setup)
6. [Testing](#testing)

---

## API Endpoints

### New Live Endpoints

#### 1. Check-In with Live Selfie
```
POST /api/attendance/check-in-live
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- latitude: number (required)
- longitude: number (required)
- selfie: file (required, image file)
- accuracy: number (optional, GPS accuracy in meters)
- notes: string (optional)
- platform: string (optional, 'web', 'mobile', 'ios', 'android')
```

#### 2. Check-Out with Live Selfie
```
POST /api/attendance/check-out-live
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- latitude: number (required)
- longitude: number (required)
- selfie: file (required, image file)
- accuracy: number (optional)
- notes: string (optional)
```

#### 3. Verify Location (Geofencing)
```
POST /api/attendance/verify-location
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "latitude": 28.7041,
  "longitude": 77.1025
}
```

#### 4. Get Selfie Image
```
GET /api/attendance/selfie/:filename
Authorization: Bearer <token>
```

Or directly access:
```
GET /uploads/attendance/selfies/:filename
```

---

## Web App Integration

### Complete HTML/JavaScript Implementation

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Attendance Check-In</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
    }
    .container {
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 10px;
    }
    video {
      width: 100%;
      max-width: 400px;
      border: 2px solid #333;
      border-radius: 10px;
      margin: 20px 0;
    }
    canvas {
      display: none;
    }
    button {
      padding: 15px 30px;
      font-size: 16px;
      margin: 10px 5px;
      cursor: pointer;
      border: none;
      border-radius: 5px;
      background-color: #4CAF50;
      color: white;
    }
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    button.danger {
      background-color: #f44336;
    }
    .info {
      background-color: #e7f3fe;
      padding: 15px;
      border-left: 4px solid #2196F3;
      margin: 15px 0;
    }
    .error {
      background-color: #ffebee;
      padding: 15px;
      border-left: 4px solid #f44336;
      margin: 15px 0;
    }
    .success {
      background-color: #e8f5e9;
      padding: 15px;
      border-left: 4px solid #4CAF50;
      margin: 15px 0;
    }
    .location-info {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 Live Attendance Check-In</h1>

    <div id="status" class="info">
      Ready to check in
    </div>

    <div class="location-info" id="locationInfo">
      <strong>Location:</strong> Fetching...
    </div>

    <!-- Camera Feed -->
    <div id="cameraSection">
      <h3>Step 1: Capture Selfie</h3>
      <video id="video" autoplay playsinline></video>
      <canvas id="canvas"></canvas>
      <br>
      <button id="captureBtn" onclick="captureSelfie()">
        📷 Capture Selfie
      </button>
      <button id="retakeBtn" onclick="retakeSelfie()" style="display: none;">
        🔄 Retake
      </button>
    </div>

    <!-- Preview -->
    <div id="previewSection" style="display: none;">
      <h3>Preview</h3>
      <img id="preview" style="max-width: 100%; border-radius: 10px;">
    </div>

    <!-- Check-In Button -->
    <div>
      <h3>Step 2: Check-In</h3>
      <button id="checkInBtn" onclick="checkIn()" disabled>
        ✅ Check-In Now
      </button>
    </div>

    <div id="result"></div>
  </div>

  <script>
    const API_URL = 'http://localhost:5000/api';
    const token = localStorage.getItem('authToken'); // Get from login

    let video = document.getElementById('video');
    let canvas = document.getElementById('canvas');
    let capturedImage = null;
    let currentLocation = null;

    // Initialize camera and location on page load
    window.addEventListener('load', async () => {
      await startCamera();
      await getCurrentLocation();
    });

    // Start camera
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Front camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        video.srcObject = stream;

        showStatus('Camera ready. Please capture your selfie.', 'info');
      } catch (error) {
        console.error('Camera error:', error);
        showStatus('Camera access denied. Please allow camera permissions.', 'error');
      }
    }

    // Get current GPS location
    async function getCurrentLocation() {
      if (!navigator.geolocation) {
        showStatus('Geolocation not supported', 'error');
        return;
      }

      showStatus('Getting your location...', 'info');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          console.log('📍 Location:', currentLocation);

          // Get address using reverse geocoding (from backend)
          await displayLocation();

          // Optional: Verify if location is within geofence
          await verifyLocation();

        },
        (error) => {
          console.error('Location error:', error);
          showStatus('Location access denied. Please allow location permissions.', 'error');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    // Display location information
    async function displayLocation() {
      if (!currentLocation) return;

      const { latitude, longitude, accuracy } = currentLocation;

      document.getElementById('locationInfo').innerHTML = `
        <strong>📍 Location:</strong><br>
        Latitude: ${latitude.toFixed(6)}<br>
        Longitude: ${longitude.toFixed(6)}<br>
        Accuracy: ${accuracy.toFixed(1)} meters<br>
        <small>Address will be auto-detected on check-in</small>
      `;
    }

    // Verify location is within office geofence (optional)
    async function verifyLocation() {
      if (!currentLocation) return;

      try {
        const response = await fetch(`${API_URL}/attendance/verify-location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          })
        });

        const data = await response.json();

        if (data.allowed === false) {
          showStatus(`⚠️ Warning: ${data.geofenceCheck.message}`, 'error');
        } else {
          console.log('✅ Location verified');
        }
      } catch (error) {
        console.error('Location verification error:', error);
      }
    }

    // Capture selfie from video stream
    function captureSelfie() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0);

      // Convert to blob
      canvas.toBlob((blob) => {
        capturedImage = blob;

        // Show preview
        const preview = document.getElementById('preview');
        preview.src = URL.createObjectURL(blob);
        document.getElementById('previewSection').style.display = 'block';

        // Hide capture button, show retake
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'inline-block';

        // Enable check-in button
        document.getElementById('checkInBtn').disabled = false;

        showStatus('Selfie captured! You can now check-in.', 'success');
      }, 'image/jpeg', 0.9);
    }

    // Retake selfie
    function retakeSelfie() {
      capturedImage = null;
      document.getElementById('previewSection').style.display = 'none';
      document.getElementById('captureBtn').style.display = 'inline-block';
      document.getElementById('retakeBtn').style.display = 'none';
      document.getElementById('checkInBtn').disabled = true;

      showStatus('Capture a new selfie', 'info');
    }

    // Check-In with selfie and location
    async function checkIn() {
      if (!capturedImage) {
        showStatus('Please capture a selfie first', 'error');
        return;
      }

      if (!currentLocation) {
        showStatus('Location not available. Please wait...', 'error');
        await getCurrentLocation();
        return;
      }

      showStatus('Checking in...', 'info');

      // Prepare form data
      const formData = new FormData();
      formData.append('latitude', currentLocation.latitude);
      formData.append('longitude', currentLocation.longitude);
      formData.append('accuracy', currentLocation.accuracy);
      formData.append('selfie', capturedImage, 'selfie.jpg');
      formData.append('notes', 'Checked in from web app');
      formData.append('platform', 'web');

      try {
        const response = await fetch(`${API_URL}/attendance/check-in-live`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          showStatus('✅ Check-in successful!', 'success');

          // Display result
          document.getElementById('result').innerHTML = `
            <div class="success">
              <h3>✅ Checked In Successfully!</h3>
              <p><strong>Time:</strong> ${new Date(data.attendance.checkInTime).toLocaleString()}</p>
              <p><strong>Location:</strong> ${data.attendance.location.address}</p>
              <p><strong>Coordinates:</strong> ${data.attendance.location.latitude.toFixed(6)}, ${data.attendance.location.longitude.toFixed(6)}</p>
              ${data.attendance.geofenceCheck ? `
                <p><strong>Distance from office:</strong> ${data.attendance.geofenceCheck.distanceText}</p>
              ` : ''}
              <img src="${API_URL.replace('/api', '')}${data.attendance.selfie}"
                   style="max-width: 200px; border-radius: 10px; margin-top: 10px;">
            </div>
          `;

          // Stop camera
          video.srcObject.getTracks().forEach(track => track.stop());
          document.getElementById('cameraSection').style.display = 'none';

        } else {
          showStatus(`❌ Check-in failed: ${data.message}`, 'error');
        }

      } catch (error) {
        console.error('Check-in error:', error);
        showStatus(`❌ Error: ${error.message}`, 'error');
      }
    }

    // Show status message
    function showStatus(message, type = 'info') {
      const statusDiv = document.getElementById('status');
      statusDiv.className = type;
      statusDiv.textContent = message;
    }
  </script>
</body>
</html>
```

---

## React/Next.js Integration

### React Component with Hooks

```javascript
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const LiveAttendanceCheckIn = () => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Fetching location...');
  const [capturedImage, setCapturedImage] = useState(null);
  const [status, setStatus] = useState('Ready to check in');
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // Initialize camera and location
  useEffect(() => {
    startCamera();
    getCurrentLocation();

    return () => {
      // Cleanup: stop camera when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('Camera ready');
    } catch (error) {
      console.error('Camera error:', error);
      setStatus('Camera access denied');
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation not supported');
      return;
    }

    setStatus('Getting location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        setLocation(loc);
        setAddress(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
        setStatus('Location obtained');
      },
      (error) => {
        console.error('Location error:', error);
        setStatus('Location access denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Capture selfie
  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      setCapturedImage(blob);
      setStatus('Selfie captured');
    }, 'image/jpeg', 0.9);
  };

  // Check-In
  const handleCheckIn = async () => {
    if (!capturedImage) {
      setStatus('Please capture a selfie first');
      return;
    }

    if (!location) {
      setStatus('Location not available');
      return;
    }

    setIsLoading(true);
    setStatus('Checking in...');

    const formData = new FormData();
    formData.append('latitude', location.latitude);
    formData.append('longitude', location.longitude);
    formData.append('accuracy', location.accuracy);
    formData.append('selfie', capturedImage, 'selfie.jpg');
    formData.append('notes', 'Checked in from React app');
    formData.append('platform', 'web');

    try {
      const response = await axios.post(
        `${API_URL}/attendance/check-in-live`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setStatus('Check-in successful!');
      console.log('Check-in response:', response.data);

      // Show success message
      alert(`Checked in successfully at ${response.data.attendance.location.address}`);

    } catch (error) {
      console.error('Check-in error:', error);
      setStatus(`Check-in failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>📸 Live Check-In</h1>

      <div style={{ padding: '15px', background: '#e7f3fe', borderRadius: '5px', marginBottom: '20px' }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '5px', marginBottom: '20px' }}>
        <strong>📍 Location:</strong><br />
        {address}
        {location && (
          <>
            <br />Accuracy: {location.accuracy.toFixed(1)} meters
          </>
        )}
      </div>

      {/* Camera Feed */}
      <div>
        <h3>Step 1: Capture Selfie</h3>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            maxWidth: '400px',
            border: '2px solid #333',
            borderRadius: '10px',
            marginBottom: '10px'
          }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <br />

        {!capturedImage ? (
          <button
            onClick={captureSelfie}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            📷 Capture Selfie
          </button>
        ) : (
          <>
            <img
              src={URL.createObjectURL(capturedImage)}
              alt="Captured selfie"
              style={{
                maxWidth: '100%',
                borderRadius: '10px',
                marginBottom: '10px'
              }}
            />
            <br />
            <button
              onClick={() => setCapturedImage(null)}
              style={{
                padding: '10px 20px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              🔄 Retake
            </button>
          </>
        )}
      </div>

      {/* Check-In Button */}
      <div style={{ marginTop: '20px' }}>
        <h3>Step 2: Check-In</h3>
        <button
          onClick={handleCheckIn}
          disabled={!capturedImage || !location || isLoading}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            background: capturedImage && location ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: capturedImage && location ? 'pointer' : 'not-allowed'
          }}
        >
          {isLoading ? '⏳ Checking in...' : '✅ Check-In Now'}
        </button>
      </div>
    </div>
  );
};

export default LiveAttendanceCheckIn;
```

---

## React Native Mobile App

### Complete React Native Component

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  PermissionsAndroid
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';

const LiveCheckIn = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Getting location...');
  const [photo, setPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const cameraRef = useRef(null);

  const API_URL = 'https://your-api.com/api';
  const token = 'YOUR_AUTH_TOKEN'; // Get from secure storage

  useEffect(() => {
    requestPermissions();
  }, []);

  // Request camera and location permissions
  const requestPermissions = async () => {
    // Camera permission
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();

    // Location permission
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

    if (cameraStatus === 'granted' && locationStatus === 'granted') {
      setHasPermission(true);
      getCurrentLocation();
    } else {
      setHasPermission(false);
      Alert.alert('Permissions required', 'Camera and location permissions are required');
    }
  };

  // Get current GPS location
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (addresses.length > 0) {
        const addr = addresses[0];
        setAddress(`${addr.street}, ${addr.city}, ${addr.region}`);
      }

    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location');
    }
  };

  // Capture photo from camera
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false
        });

        setPhoto(photo);
        console.log('Photo captured:', photo.uri);

      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  // Check-In with photo and location
  const handleCheckIn = async () => {
    if (!photo) {
      Alert.alert('Error', 'Please capture a selfie first');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('latitude', location.latitude);
    formData.append('longitude', location.longitude);
    formData.append('accuracy', location.accuracy);
    formData.append('notes', 'Checked in from mobile app');
    formData.append('platform', Platform.OS);

    // Add photo to form data
    formData.append('selfie', {
      uri: photo.uri,
      type: 'image/jpeg',
      name: 'selfie.jpg'
    });

    try {
      const response = await axios.post(
        `${API_URL}/attendance/check-in-live`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      console.log('Check-in successful:', response.data);

      Alert.alert(
        'Success!',
        `Checked in at ${response.data.attendance.location.address}`,
        [{ text: 'OK' }]
      );

      // Reset
      setPhoto(null);

    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to check in'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting permissions...</Text></View>;
  }

  if (hasPermission === false) {
    return <View style={styles.container}><Text>No access to camera or location</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📸 Live Check-In</Text>

      <View style={styles.locationCard}>
        <Text style={styles.locationText}>📍 {address}</Text>
        {location && (
          <Text style={styles.accuracyText}>
            Accuracy: {location.accuracy.toFixed(1)}m
          </Text>
        )}
      </View>

      {!photo ? (
        <>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={CameraType.front}
          />

          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <Text style={styles.buttonText}>📷 Capture Selfie</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Image source={{ uri: photo.uri }} style={styles.preview} />

          <TouchableOpacity
            style={[styles.button, styles.retakeButton]}
            onPress={() => setPhoto(null)}
          >
            <Text style={styles.buttonText}>🔄 Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.checkInButton]}
            onPress={handleCheckIn}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? '⏳ Checking in...' : '✅ Check-In'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  locationCard: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  locationText: {
    fontSize: 16,
    marginBottom: 5
  },
  accuracyText: {
    fontSize: 14,
    color: '#666'
  },
  camera: {
    width: '100%',
    height: 400,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20
  },
  preview: {
    width: '100%',
    height: 400,
    borderRadius: 10,
    marginBottom: 20
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center'
  },
  button: {
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10
  },
  retakeButton: {
    backgroundColor: '#f44336'
  },
  checkInButton: {
    backgroundColor: '#4CAF50'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  }
});

export default LiveCheckIn;
```

---

## Environment Setup

### Backend Configuration (.env)

```env
# Optional: Google Maps API Key for geocoding
# If not provided, will use OpenStreetMap (free)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Optional: Office location for geofencing
OFFICE_LATITUDE=28.7041
OFFICE_LONGITUDE=77.1025
OFFICE_RADIUS_METERS=200

# JWT Secret
JWT_SECRET=your_jwt_secret

# MongoDB URI
MONGO_URI=your_mongodb_uri
```

### Install Required Packages

```bash
npm install multer axios
```

---

## Testing

### Test with cURL

```bash
# 1. Login to get token
curl -X POST http://localhost:5000/api/superadmin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'

# 2. Check-in with selfie
curl -X POST http://localhost:5000/api/attendance/check-in-live \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "latitude=28.7041" \
  -F "longitude=77.1025" \
  -F "accuracy=10.5" \
  -F "selfie=@/path/to/selfie.jpg" \
  -F "notes=Test check-in" \
  -F "platform=web"

# 3. Verify location
curl -X POST http://localhost:5000/api/attendance/verify-location \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.7041,
    "longitude": 77.1025
  }'
```

---

## Features

✅ **Live Selfie Capture** - Real-time camera feed with front-facing camera
✅ **GPS Location Tracking** - High-accuracy location with distance calculation
✅ **Auto-Geocoding** - Automatic address detection from coordinates
✅ **Geofencing** - Optional office location verification
✅ **Multi-Provider Support** - Google Maps API + OpenStreetMap fallback
✅ **Image Storage** - Secure file upload and storage
✅ **Cross-Platform** - Works on web, iOS, and Android

---

## Security Notes

1. **Selfie images** are stored locally in `/uploads/attendance/selfies/`
2. **File size limit** is 5MB per image
3. **Allowed formats**: JPEG, PNG, WebP
4. **Images are named** with userId_timestamp_type.ext pattern
5. **Authentication required** for all endpoints
6. **GPS accuracy** is recorded for audit purposes

---

## Troubleshooting

### Camera not working?
- Check browser/app permissions
- Use HTTPS (required for camera access in browsers)
- Try different browser/device

### Location not accurate?
- Enable high-accuracy GPS
- Go outside for better signal
- Check device location settings

### Geocoding failed?
- System will fallback to coordinates
- Check internet connection
- Verify Google Maps API key (if using)

### Upload failed?
- Check file size (max 5MB)
- Verify image format (JPEG/PNG/WebP)
- Check network connection

---

**Your attendance system now has live verification with selfie capture, GPS tracking, and automatic geocoding! 🎉**
