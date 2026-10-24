import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('=== OMNILENS END-TO-END VALIDATION SUITE ===\n');

  // Test 1: Health Endpoint
  try {
    const healthRes = await fetch('http://127.0.0.1:3000/api/health');
    const health = await healthRes.json();
    console.log('Test 1: GET /api/health -> Status:', healthRes.status, health);
  } catch (err: any) {
    console.error('Test 1 failed:', err.message);
  }

  // Test 2: OpenCV Status
  try {
    const cvRes = await fetch('http://127.0.0.1:3000/api/opencv/status');
    const cv = await cvRes.json();
    console.log('\nTest 2: GET /api/opencv/status -> Status:', cvRes.status, cv);
  } catch (err: any) {
    console.error('Test 2 failed:', err.message);
  }

  // Load sample image
  const roomImgPath = path.resolve(process.cwd(), 'src/assets/sample-room.jpg');
  const roomBase64 = fs.existsSync(roomImgPath)
    ? `data:image/jpeg;base64,${fs.readFileSync(roomImgPath).toString('base64')}`
    : 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // Test 3: SafePath Camera Obstacle Detection
  try {
    console.log('\nTest 3: POST /api/safepath/analyze (Obstacle Awareness)...');
    const spRes = await fetch('http://127.0.0.1:3000/api/safepath/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: roomBase64, sensitivity: 0.25 })
    });
    const spData = await spRes.json();
    console.log('SafePath Status:', spRes.status, {
      path_status: spData.path_status,
      spoken_alert: spData.spoken_alert,
      obstacles_count: spData.obstacles?.length,
      model_status: spData.model_status,
      opencv_quality: spData.opencv_quality ? {
        blur_score: spData.opencv_quality.blur_score,
        mean_luminance: spData.opencv_quality.mean_luminance,
        speech_guidance: spData.opencv_quality.speech_guidance
      } : null
    });
  } catch (err: any) {
    console.error('Test 3 failed:', err.message);
  }

  // Test 4: Describe Surroundings
  try {
    console.log('\nTest 4: POST /api/analyze-vision (Describe Surroundings)...');
    const descRes = await fetch('http://127.0.0.1:3000/api/analyze-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: roomBase64, confidence: 0.20 })
    });
    const descData = await descRes.json();
    console.log('Describe Surroundings Status:', descRes.status, {
      scene: descData.scene_description?.slice(0, 100) + '...',
      guidance: descData.navigation_guidance?.slice(0, 100) + '...',
      detections_count: descData.detections?.length,
      first_3_labels: descData.detections?.slice(0, 3).map((d: any) => d.label)
    });
  } catch (err: any) {
    console.error('Test 4 failed:', err.message);
  }

  // Test 5: Find Object (e.g. door or table)
  try {
    console.log('\nTest 5: POST /api/analyze-vision (Find Object: door)...');
    const findRes = await fetch('http://127.0.0.1:3000/api/analyze-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: roomBase64, requestedObject: 'door', confidence: 0.20 })
    });
    const findData = await findRes.json();
    console.log('Find Object Status:', findRes.status, {
      detections_count: findData.detections?.length,
      matching_objects: findData.detections?.map((d: any) => ({
        label: d.label,
        side: d.sideDirection,
        confidence: d.confidence
      }))
    });
  } catch (err: any) {
    console.error('Test 5 failed:', err.message);
  }

  // Test 6: OCR Vision
  const ocrImgPath = path.resolve(process.cwd(), 'src/assets/sample-ocr.jpg');
  const ocrBase64 = fs.existsSync(ocrImgPath)
    ? `data:image/jpeg;base64,${fs.readFileSync(ocrImgPath).toString('base64')}`
    : roomBase64;
  try {
    console.log('\nTest 6: POST /api/ocr-vision (Neural OCR)...');
    const ocrRes = await fetch('http://127.0.0.1:3000/api/ocr-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: ocrBase64 })
    });
    const ocrData = await ocrRes.json();
    console.log('OCR Status:', ocrRes.status, {
      extracted_text: ocrData.extracted_text?.slice(0, 80) + '...',
      summary: ocrData.summary,
      line_count: ocrData.lines?.length
    });
  } catch (err: any) {
    console.error('Test 6 failed:', err.message);
  }

  // Test 7: Navigation Search
  try {
    console.log('\nTest 7: GET /api/navigation/search (Geocoding search)...');
    const navSearchRes = await fetch('http://127.0.0.1:3000/api/navigation/search?q=Central%20Park');
    const navSearchData = await navSearchRes.json();
    console.log('Navigation Search Status:', navSearchRes.status, {
      results_count: navSearchData.results?.length,
      first_result: navSearchData.results?.[0]?.display_name
    });
  } catch (err: any) {
    console.error('Test 7 failed:', err.message);
  }

  // Test 8: Pedestrian Navigation Route
  try {
    console.log('\nTest 8: POST /api/navigation/route (Turn-by-turn routing)...');
    const routeRes = await fetch('http://127.0.0.1:3000/api/navigation/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startLat: 40.785091,
        startLng: -73.968285,
        destLat: 40.782865,
        destLng: -73.965355,
        destinationName: 'The Lake'
      })
    });
    const routeData = await routeRes.json();
    console.log('Route Status:', routeRes.status, {
      distance_meters: routeData.distance_meters,
      duration_minutes: routeData.duration_minutes,
      steps_count: routeData.steps?.length,
      first_step: routeData.steps?.[0]?.instruction,
      external_fallbacks: {
        google: Boolean(routeData.external_links?.google_maps),
        apple: Boolean(routeData.external_links?.apple_maps)
      }
    });
  } catch (err: any) {
    console.error('Test 8 failed:', err.message);
  }

  // Test 9: Input Validation & Error Handling (Missing image)
  try {
    console.log('\nTest 9: POST /api/safepath/analyze (Validation error check)...');
    const errRes = await fetch('http://127.0.0.1:3000/api/safepath/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const errData = await errRes.json();
    console.log('Error Validation Status (expect 400):', errRes.status, errData);
  } catch (err: any) {
    console.error('Test 9 failed:', err.message);
  }

  // Test 10: OpenCV Standalone Processing Endpoint
  try {
    console.log('\nTest 10: POST /api/opencv/process (OpenCV preprocessing verification)...');
    const cvProcRes = await fetch('http://127.0.0.1:3000/api/opencv/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: roomBase64, apply_clahe: true })
    });
    const cvProcData = await cvProcRes.json();
    console.log('OpenCV Processing Status:', cvProcRes.status, {
      blur_score: cvProcData.blur_score,
      is_blurry: cvProcData.is_blurry,
      mean_luminance: cvProcData.mean_luminance,
      speech_guidance: cvProcData.speech_guidance,
      processing_time_ms: cvProcData.processing_time_ms,
      opencv_version: cvProcData.opencv_version
    });
  } catch (err: any) {
    console.error('Test 10 failed:', err.message);
  }

  console.log('\n=== END-TO-END VALIDATION COMPLETE ===');
}

runTests();
