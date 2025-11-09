       let referenceFiles = [];
        let photosFiles = [];
        let matchedPhotos = [];

        // DOM Elements
        const referenceInput = document.getElementById('referenceInput');
        const photosInput = document.getElementById('photosInput');
        const processBtn = document.getElementById('processBtn');
        const toleranceSlider = document.getElementById('toleranceSlider');
        const toleranceValue = document.getElementById('toleranceValue');
        const logSection = document.getElementById('logSection');
        const progressSection = document.getElementById('progressSection');
        const resultsSection = document.getElementById('resultsSection');
        const downloadBtn = document.getElementById('downloadBtn');

        // Load face-api models
        let modelsLoaded = false;

        async function loadModels() {
            try {
                log('Loading AI models...', 'info');
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                modelsLoaded = true;
                log('✅ AI models loaded successfully!', 'success');
            } catch (error) {
                log('❌ Error loading models: ' + error.message, 'error');
            }
        }

        // Initialize
        loadModels();

        // Event Listeners
        referenceInput.addEventListener('change', handleReferenceUpload);
        photosInput.addEventListener('change', handlePhotosUpload);
        processBtn.addEventListener('click', processPhotos);
        toleranceSlider.addEventListener('input', (e) => {
            toleranceValue.textContent = e.target.value;
        });
        downloadBtn.addEventListener('click', downloadMatches);

        function handleReferenceUpload(e) {
            referenceFiles = Array.from(e.target.files);
            const info = document.getElementById('referenceInfo');
            const preview = document.getElementById('referencePreview');
            
            info.style.display = 'block';
            info.textContent = `${referenceFiles.length} reference image(s) selected`;
            
            preview.innerHTML = '';
            referenceFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'preview-item';
                    div.innerHTML = `
                        <img src="${e.target.result}" alt="Reference ${index + 1}">
                        <button class="remove-btn" onclick="removeReference(${index})">×</button>
                    `;
                    preview.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
            
            checkReadyToProcess();
        }

        function handlePhotosUpload(e) {
            photosFiles = Array.from(e.target.files);
            const info = document.getElementById('photosInfo');
            info.style.display = 'block';
            info.textContent = `${photosFiles.length} photos selected for searching`;
            checkReadyToProcess();
        }

        function removeReference(index) {
            referenceFiles.splice(index, 1);
            referenceInput.value = '';
            handleReferenceUpload({ target: { files: referenceFiles } });
        }

        function checkReadyToProcess() {
            processBtn.disabled = !(referenceFiles.length > 0 && photosFiles.length > 0 && modelsLoaded);
        }

        function log(message, type = 'info') {
            const logLine = document.createElement('div');
            logLine.className = `log-line ${type}`;
            logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logSection.appendChild(logLine);
            logSection.scrollTop = logSection.scrollHeight;
            logSection.style.display = 'block';
        }

        function updateProgress(current, total) {
            const percent = Math.round((current / total) * 100);
            document.getElementById('progressFill').style.width = percent + '%';
            document.getElementById('progressFill').textContent = percent + '%';
            document.getElementById('progressText').textContent = `Processing ${current} of ${total} photos...`;
        }

        async function processPhotos() {
            processBtn.disabled = true;
            progressSection.style.display = 'block';
            resultsSection.style.display = 'none';
            logSection.innerHTML = '';
            matchedPhotos = [];

            const tolerance = parseFloat(toleranceSlider.value);
            
            log('🚀 Starting face matching process...', 'info');
            log(`Settings: Tolerance=${tolerance}, CNN=${document.getElementById('useCNN').checked}`, 'info');

            try {
                // Load reference descriptors
                log('📸 Loading reference images...', 'info');
                const referenceDescriptors = [];
                
                for (let i = 0; i < referenceFiles.length; i++) {
                    const img = await loadImage(referenceFiles[i]);
                    const detections = await faceapi.detectAllFaces(img)
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    if (detections.length === 0) {
                        log(`⚠️ No face found in reference image ${i + 1}`, 'warning');
                    } else {
                        referenceDescriptors.push(...detections.map(d => d.descriptor));
                        log(`✅ Found ${detections.length} face(s) in reference image ${i + 1}`, 'success');
                    }
                }

                if (referenceDescriptors.length === 0) {
                    throw new Error('No faces found in any reference image!');
                }

                log(`Total reference faces loaded: ${referenceDescriptors.length}`, 'success');
                log('', 'info');

                // Process photos
                let matchCount = 0;
                for (let i = 0; i < photosFiles.length; i++) {
                    updateProgress(i + 1, photosFiles.length);
                    
                    const file = photosFiles[i];
                    log(`[${i + 1}/${photosFiles.length}] Processing: ${file.name}`, 'info');

                    try {
                        const img = await loadImage(file);
                        const detections = await faceapi.detectAllFaces(img)
                            .withFaceLandmarks()
                            .withFaceDescriptors();

                        if (detections.length === 0) {
                            log(`  ❌ No faces detected`, 'error');
                            continue;
                        }

                        let matchFound = false;
                        let bestDistance = 1;

                        for (const detection of detections) {
                            for (const refDescriptor of referenceDescriptors) {
                                const distance = faceapi.euclideanDistance(detection.descriptor, refDescriptor);
                                bestDistance = Math.min(bestDistance, distance);
                                
                                if (distance < tolerance) {
                                    matchFound = true;
                                    break;
                                }
                            }
                            if (matchFound) break;
                        }

                        if (matchFound) {
                            const confidence = ((1 - bestDistance) * 100).toFixed(1);
                            log(`  ✅ MATCH FOUND - Confidence: ${confidence}%`, 'success');
                            matchCount++;
                            matchedPhotos.push({
                                file: file,
                                confidence: confidence,
                                url: URL.createObjectURL(file)
                            });
                        } else {
                            const bestConfidence = ((1 - bestDistance) * 100).toFixed(1);
                            log(`  ❌ No match (best: ${bestConfidence}%)`, 'error');
                        }

                    } catch (error) {
                        log(`  ✗ Error: ${error.message}`, 'error');
                    }
                }

                // Show results
                log('', 'info');
                log('='.repeat(50), 'info');
                log('✅ PROCESSING COMPLETE!', 'success');
                log('='.repeat(50), 'info');
                log(`Total photos processed: ${photosFiles.length}`, 'info');
                log(`Matches found: ${matchCount}`, 'success');
                log(`Success rate: ${((matchCount / photosFiles.length) * 100).toFixed(1)}%`, 'info');

                displayResults(photosFiles.length, matchCount);

            } catch (error) {
                log('❌ Error during processing: ' + error.message, 'error');
                alert('Error: ' + error.message);
            } finally {
                processBtn.disabled = false;
                progressSection.style.display = 'none';
            }
        }

        function displayResults(total, matched) {
            resultsSection.style.display = 'block';
            document.getElementById('totalPhotos').textContent = total;
            document.getElementById('matchedPhotos').textContent = matched;
            document.getElementById('successRate').textContent = 
                ((matched / total) * 100).toFixed(1) + '%';

            const gallery = document.getElementById('matchedGallery');
            gallery.innerHTML = '';
            
            matchedPhotos.forEach(photo => {
                const div = document.createElement('div');
                div.className = 'matched-item';
                div.innerHTML = `<img src="${photo.url}" alt="Match" title="Confidence: ${photo.confidence}%">`;
                gallery.appendChild(div);
            });

            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }

        async function downloadMatches() {
            if (matchedPhotos.length === 0) {
                alert('No matched photos to download!');
                return;
            }

            log('📦 Creating ZIP file...', 'info');
            const zip = new JSZip();
            
            for (let i = 0; i < matchedPhotos.length; i++) {
                const photo = matchedPhotos[i];
                zip.file(photo.file.name, photo.file);
            }

            log('⬇️ Generating download...', 'info');
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `matched_faces_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log('✅ Download started!', 'success');
        }

        function loadImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        }