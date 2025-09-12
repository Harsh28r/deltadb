async function captureAndSubmitSelfie() {
  try {
    // Access camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // Capture image after 3 seconds
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg');

      // Stop camera
      stream.getTracks().forEach(track => track.stop());

      // Submit to API
      fetch('http://localhost:5000/api/cp-sourcings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelPartnerData: {
            name: 'John Doe',
            phone: '9876543210',
            firmName: 'Doe Realty',
            location: 'Mumbai',
            address: '123 Main St',
            mahareraNo: 'MHR123456',
            pinCode: '400001'
          },
          projectId: '68be6a1fb2a42ef6c9e04814',
          location: { lat: 19.0760, lng: 72.8777 },
          notes: 'First visit',
          selfie: base64Image
        })
      })
      .then(res => res.json())
      .then(data => console.log('Success:', data))
      .catch(err => console.error('Error:', err));
    }, 3000);
  } catch (err) {
    console.error('Camera access error:', err);
  }
}