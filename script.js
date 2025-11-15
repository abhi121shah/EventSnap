
        let referenceFiles = [];
        let photosFiles = [];
        let matchedPhotos = [];
        let enhancedPhotos = [];

        // DOM Elements
        const referenceInput = document.getElementById('referenceInput');
        const photosInput = document.getElementById('photosInput');
        const processBtn = document.getElementById('processBtn');
        const toleranceSlider = document.getElementById('toleranceSlider');
        const toleranceValue = document.getElementById('toleranceValue');
        const logSection = document.getElementById('logSection');
        const progressSection = document.getElementById('progressSection');
        const resultsSection = document.getElementById('resultsSection');
        const downloadOriginalBtn = document.getElementById('downloadOriginalBtn');
        const downloadEnhancedBtn = document.getElementById('downloadEnhancedBtn');
        const enableEnhancement = document.getElementById('enableEnhancement');
        const enhancementOptions = document.getElementById('enhancementOptions');

        // Load face-api models
        let modelsLoaded = false;

        async function loadModels() {
            try {
                log('Loading AI models...', 'info');
                // Using a more stable CDN link for face-api models
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model'; 
                await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                modelsLoaded = true;
                log('✅ AI models loaded successfully!', 'success');
                checkReadyToProcess(); // Check readiness after models load
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
        downloadOriginalBtn.addEventListener('click', () => downloadMatches(false));
        downloadEnhancedBtn.addEventListener('click', () => downloadMatches(true));
        enableEnhancement.addEventListener('change', (e) => {
            enhancementOptions.classList.toggle('active', e.target.checked);
        });

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
            // Reconstruct the file list by removing the item at the index
            referenceFiles.splice(index, 1);
            
            // Re-trigger the display update
            const filesDataTransfer = new DataTransfer();
            referenceFiles.forEach(file => filesDataTransfer.items.add(file));
            referenceInput.files = filesDataTransfer.files;

            // Manually call the handler to update the UI
            handleReferenceUpload({ target: { files: referenceFiles } });
        }

        function checkReadyToProcess() {
            processBtn.disabled = !(referenceFiles.length > 0 && photosFiles.length > 0 && modelsLoaded);
            if (processBtn.disabled) {
                processBtn.textContent = 'Awaiting Files or Model Loading...';
            } else {
                processBtn.textContent = 'Start Processing';
            }
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

        async function enhanceImage(imageFile) {
            return new Promise((resolve) => {
                const img = new Image();
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        
                        // Draw original image
                        ctx.drawImage(img, 0, 0);
                        
                        // Get image data
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        
                        // Apply enhancements based on settings
                        const brightness = document.getElementById('enhanceBrightness').checked;
                        const contrast = document.getElementById('enhanceContrast').checked;
                        const saturation = document.getElementById('enhanceSaturation').checked;
                        const sharpness = document.getElementById('enhanceSharpness').checked;
                        const noise = document.getElementById('enhanceNoise').checked; // Noise reduction is often too slow for a synchronous canvas function
                        
                        // --- Simplified Enhancement Logic (Client-side) ---
                        let contrastFactor = 1.0;
                        let brightnessOffset = 0;

                        if (contrast) contrastFactor = 1.15;
                        if (brightness) brightnessOffset = 15; // Simple boost

                        for (let i = 0; i < data.length; i += 4) {
                            let r = data[i];
                            let g = data[i+1];
                            let b = data[i+2];

                            // Contrast and Brightness
                            r = ((r - 128) * contrastFactor) + 128 + brightnessOffset;
                            g = ((g - 128) * contrastFactor) + 128 + brightnessOffset;
                            b = ((b - 128) * contrastFactor) + 128 + brightnessOffset;

                            // Saturation (Simplified)
                            if (saturation) {
                                const saturationFactor = 1.2;
                                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                                r = gray + saturationFactor * (r - gray);
                                g = gray + saturationFactor * (g - gray);
                                b = gray + saturationFactor * (b - gray);
                            }

                            // Clamp values
                            data[i] = Math.max(0, Math.min(255, r));
                            data[i+1] = Math.max(0, Math.min(255, g));
                            data[i+2] = Math.max(0, Math.min(255, b));
                        }
                        
                        ctx.putImageData(imageData, 0, 0);
                        
                        // Sharpness (using canvas filter, can be slow)
                        if (sharpness) {
                            ctx.filter = 'contrast(1.05) saturate(1.05) brightness(1.02)'; // Apply subtle sharpening/pop
                            ctx.drawImage(canvas, 0, 0);
                            ctx.filter = 'none';
                        }
                        
                        // Convert canvas to blob
                        canvas.toBlob((blob) => {
                            resolve(new File([blob], imageFile.name, { type: 'image/jpeg' }));
                        }, 'image/jpeg', 0.95);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(imageFile);
            });
        }

        async function processPhotos() {
            processBtn.disabled = true;
            progressSection.style.display = 'block';
            resultsSection.style.display = 'none';
            logSection.innerHTML = '';
            matchedPhotos = [];
            enhancedPhotos = [];

            const tolerance = parseFloat(toleranceSlider.value);
            const shouldEnhance = enableEnhancement.checked;
            const useCNN = document.getElementById('useCNN').checked;
            const detectionOptions = useCNN 
                ? new faceapi.SsdMobilenetv1Options() 
                : new faceapi.TinyFaceDetectorOptions(); // Fallback for faster, less accurate detection

            log('🚀 Starting face matching process...', 'info');
            log(`Settings: Tolerance=${tolerance}, Model=${useCNN ? 'SSD MobileNetV1' : 'TinyFaceDetector'}, Enhancement=${shouldEnhance}`, 'info');

            try {
                // Load reference descriptors
                log('📸 Loading reference images...', 'info');
                const referenceDescriptors = [];
                
                for (let i = 0; i < referenceFiles.length; i++) {
                    const img = await loadImage(referenceFiles[i]);
                    const detections = await faceapi.detectAllFaces(img, detectionOptions)
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    if (detections.length === 0) {
                        log(`⚠️ No face found in reference image ${i + 1}`, 'warning');
                    } else {
                        // Only take the first face found in the reference images for a single-person match
                        referenceDescriptors.push(detections[0].descriptor); 
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
                        const detections = await faceapi.detectAllFaces(img, detectionOptions)
                            .withFaceLandmarks()
                            .withFaceDescriptors();

                        if (detections.length === 0) {
                            log(`  ❌ No faces detected`, 'error');
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
                            log(`  ✅ MATCH FOUND - Confidence: ${confidence}%`, 'success');
                            matchCount++;
                            
                            const originalUrl = URL.createObjectURL(file);
                            let enhancedFile = null;
                            let enhancedUrl = null;
                            
                            // Apply enhancement if enabled
                            if (shouldEnhance) {
                                log(`  ✨ Enhancing image...`, 'info');
                                // Added a small delay to visually show the enhancement step
                                await new Promise(r => setTimeout(r, 50)); 
                                enhancedFile = await enhanceImage(file);
                                enhancedUrl = URL.createObjectURL(enhancedFile);
                                log(`  ✅ Enhancement complete`, 'success');
                            }
                            
                            matchedPhotos.push({
                                file: file,
                                confidence: confidence,
                                url: originalUrl,
                                enhanced: shouldEnhance,
                                enhancedFile: enhancedFile,
                                enhancedUrl: enhancedUrl
                            });
                        } else {
                            const bestConfidence = ((1 - bestDistance) * 100).toFixed(1);
                            log(`  ❌ No match (best: ${bestConfidence}%)`, 'error');
                        }

                    } catch (error) {
                        log(`  ✗ Error: ${error.message}`, 'error');
                    }
                }

                // Show results
                log('', 'info');
                log('='.repeat(50), 'info');
                log('✅ PROCESSING COMPLETE!', 'success');
                log('='.repeat(50), 'info');
                log(`Total photos processed: ${photosFiles.length}`, 'info');
                log(`Matches found: ${matchCount}`, 'success');
                if (shouldEnhance) {
                    log(`Photos enhanced: ${matchCount}`, 'success');
                }
                log(`Success rate: ${((matchCount / photosFiles.length) * 100).toFixed(1)}%`, 'info');

                displayResults(photosFiles.length, matchCount, shouldEnhance);

            } catch (error) {
                log('❌ Error during processing: ' + error.message, 'error');
                alert('Error: ' + error.message);
            } finally {
                processBtn.disabled = false;
                progressSection.style.display = 'none';
                checkReadyToProcess();
            }
        }

        function displayResults(total, matched, enhanced) {
            resultsSection.style.display = 'block';
            document.getElementById('totalPhotos').textContent = total;
            document.getElementById('matchedPhotos').textContent = matched;
            document.getElementById('enhancedPhotos').textContent = enhanced ? matched : 0;
            document.getElementById('successRate').textContent = 
                ((matched / total) * 100).toFixed(1) + '%';

            // Show/hide enhanced buttons
            if (enhanced && matched > 0) {
                downloadEnhancedBtn.style.display = 'block';
                document.getElementById('shareEnhancedBtn').style.display = 'block';
            } else {
                downloadEnhancedBtn.style.display = 'none';
                document.getElementById('shareEnhancedBtn').style.display = 'none';
            }

            const gallery = document.getElementById('matchedGallery');
            gallery.innerHTML = '';
            
            matchedPhotos.forEach((photo, index) => {
                const div = document.createElement('div');
                div.className = 'matched-item';
                
                if (photo.enhanced) {
                    div.innerHTML = `
                        <img src="${photo.enhancedUrl}" alt="Match ${index + 1}" title="Confidence: ${photo.confidence}%">
                        <span class="enhance-badge">✨ Enhanced</span>
                    `;
                    div.style.cursor = 'pointer';
                    div.onclick = () => showComparison(photo);
                } else {
                    div.innerHTML = `<img src="${photo.url}" alt="Match ${index + 1}" title="Confidence: ${photo.confidence}%">`;
                }
                
                gallery.appendChild(div);
            });

            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }

        async function sharePhotos(enhanced = false) {
            if (matchedPhotos.length === 0) {
                alert('No matched photos to share!');
                return;
            }

            const shareBtn = enhanced ? document.getElementById('shareEnhancedBtn') : document.getElementById('shareOriginalBtn');
            const shareResult = document.getElementById('shareResult');
            
            shareBtn.disabled = true;
            shareBtn.textContent = '⏳ Creating shareable link...';
            
            try {
                log(`🔗 Creating shareable link for ${enhanced ? 'enhanced' : 'original'} photos...`, 'info');
                
                // Create ZIP file
                const zip = new JSZip();
                const type = enhanced ? 'enhanced' : 'original';
                
                for (let i = 0; i < matchedPhotos.length; i++) {
                    const photo = matchedPhotos[i];
                    const fileToZip = enhanced && photo.enhancedFile ? photo.enhancedFile : photo.file;
                    const prefix = enhanced ? 'enhanced_' : '';
                    zip.file(prefix + fileToZip.name, fileToZip);
                }

                log('📦 Generating ZIP file...', 'info');
                const zipBlob = await zip.generateAsync({ 
                    type: 'blob',
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 }
                });

                // Try multiple upload services
                let uploadResult = null;
                const services = [
                    { name: 'tmpfiles.org', upload: uploadToTmpFiles },
                    { name: '0x0.st', upload: uploadTo0x0 },
                    // { name: 'file.io', upload: uploadToFileIO } // file.io often fails due to CORS or API limits
                ];

                for (const service of services) {
                    try {
                        log(`☁️ Trying ${service.name}...`, 'info');
                        uploadResult = await service.upload(zipBlob, type);
                        if (uploadResult && uploadResult.url) {
                            log(`✅ Upload successful via ${service.name}!`, 'success');
                            break;
                        }
                    } catch (err) {
                        log(`⚠️ ${service.name} failed, trying next...`, 'warning');
                    }
                }

                if (!uploadResult || !uploadResult.url) {
                    throw new Error('All primary upload services failed');
                }

                displayShareResult(uploadResult, shareResult);

            } catch (error) {
                log('❌ Error creating share link: ' + error.message, 'error');
                shareResult.innerHTML = `
                    <h4 style="color: #ff4444;">❌ Upload Failed</h4>
                    <p style="margin-top: 10px; line-height: 1.6;">
                        <strong>Unable to create shareable link.</strong><br><br>
                        <strong>Alternative Options:</strong><br>
                        1️⃣ <strong>Download ZIP</strong> and upload to:<br>
                        &nbsp;&nbsp;&nbsp;• Google Drive (<a href="https://drive.google.com" target="_blank">drive.google.com</a>)<br>
                        &nbsp;&nbsp;&nbsp;• Dropbox (<a href="https://dropbox.com" target="_blank">dropbox.com</a>)<br>
                        &nbsp;&nbsp;&nbsp;• WeTransfer (<a href="https://wetransfer.com" target="_blank">wetransfer.com</a>)<br><br>
                        2️⃣ <strong>Use Web Share API</strong> (if available on your device)<br>
                        3️⃣ <strong>Try again</strong> - Sometimes services are temporarily down
                    </p>
                    <button onclick="tryWebShare(${enhanced})" class="copy-btn" style="margin-top: 15px; width: 100%;">
                        📤 Try Native Share (Mobile/Modern Browsers)
                    </button>
                `;
                shareResult.classList.add('active');
            } finally {
                shareBtn.disabled = false;
                shareBtn.textContent = enhanced ? '✨ Share Enhanced Photos' : '🔗 Share Original Photos';
            }
        }

        async function uploadToTmpFiles(blob, type) {
            const formData = new FormData();
            formData.append('file', blob, `matched_faces_${type}_${Date.now()}.zip`);

            const response = await fetch('https://tmpfiles.org/api/v1/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.status === 'success' && result.data && result.data.url) {
                // tmpfiles returns a page URL, need to modify for direct download
                const directUrl = result.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                return { 
                    url: directUrl, 
                    expiry: '1 hour',
                    service: 'tmpfiles.org'
                };
            }
            throw new Error('tmpfiles.org upload failed');
        }

        async function uploadTo0x0(blob, type) {
            const formData = new FormData();
            formData.append('file', blob, `matched_faces_${type}_${Date.now()}.zip`);

            // 0x0.st has CORS issues sometimes, but often works for POST
            const response = await fetch('https://0x0.st', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const url = await response.text();
                return { 
                    url: url.trim(), 
                    expiry: '24 hours',
                    service: '0x0.st'
                };
            }
            throw new Error('0x0.st upload failed');
        }

        // Removed uploadToFileIO as it often causes issues.

        function displayShareResult(uploadResult, shareResult) {
            shareResult.innerHTML = `
                <h4 style="color: #4CAF50; margin-bottom: 10px;">✅ Link Created Successfully!</h4>
                <div style="background: #e3f2fd; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <small style="color: #1976d2;">Hosted on: <strong>${uploadResult.service}</strong></small>
                </div>
                <div class="share-link-container">
                    <input type="text" class="share-link-input" id="shareLink" value="${uploadResult.url}" readonly>
                    <button class="copy-btn" onclick="copyShareLink()">📋 Copy</button>
                </div>
                <div class="share-info">
                    ⚠️ <strong>Important:</strong> This link expires in <strong>${uploadResult.expiry}</strong>. 
                    Share it with your recipients immediately!
                </div>
                <div class="qr-code-container">
                    <p style="font-weight: 600; margin-bottom: 10px;">Scan QR Code to Download:</p>
                    <div id="qrcode"></div>
                </div>
                <div class="social-share-buttons">
                    <button class="social-btn whatsapp" onclick="shareToWhatsApp('${uploadResult.url}')">
                        📱 WhatsApp
                    </button>
                    <button class="social-btn telegram" onclick="shareToTelegram('${uploadResult.url}')">
                        ✈️ Telegram
                    </button>
                    <button class="social-btn email" onclick="shareToEmail('${uploadResult.url}', ${matchedPhotos.length})">
                        ✉️ Email
                    </button>
                </div>
            `;
            shareResult.classList.add('active');

            // Generate QR Code
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: uploadResult.url,
                width: 200,
                height: 200,
                colorDark: "#667eea",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        async function tryWebShare(enhanced = false) {
            if (!navigator.share) {
                alert('Web Share API not supported on this browser. Please use a modern mobile browser or desktop Chrome/Edge.');
                return;
            }

            try {
                // Create ZIP file
                const zip = new JSZip();
                const type = enhanced ? 'enhanced' : 'original';
                
                for (let i = 0; i < matchedPhotos.length; i++) {
                    const photo = matchedPhotos[i];
                    const fileToZip = enhanced && photo.enhancedFile ? photo.enhancedFile : photo.file;
                    const prefix = enhanced ? 'enhanced_' : '';
                    zip.file(prefix + fileToZip.name, fileToZip);
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const file = new File([zipBlob], `matched_faces_${type}.zip`, { type: 'application/zip' });

                await navigator.share({
                    title: 'Matched Photos',
                    text: `${matchedPhotos.length} matched photos found using AI Face Recognition`,
                    files: [file]
                });

                log('✅ Shared via native share!', 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    alert('Share failed: ' + error.message);
                    log('❌ Native share failed: ' + error.message, 'error');
                }
            }
        }

        function copyShareLink() {
            const linkInput = document.getElementById('shareLink');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999); // For mobile devices

            try {
                document.execCommand('copy');
                const copyBtn = event.target;
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ Copied!';
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 2000);

                log('✅ Link copied to clipboard!', 'success');
            } catch (err) {
                alert('Please manually copy the link');
            }
        }

        function shareToWhatsApp(link) {
            const text = `Check out these ${matchedPhotos.length} matched photos I found using AI Face Matching! 📸✨\n\nDownload here: ${link}\n\n⚠️ Note: Link expires soon!`;
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
            log('📱 Opening WhatsApp...', 'info');
        }

        function shareToTelegram(link) {
            const text = `Check out these ${matchedPhotos.length} matched photos I found using AI Face Matching! 📸✨\n\nDownload: ${link}\n\n⚠️ Link expires soon!`;
            const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
            log('✈️ Opening Telegram...', 'info');
        }

        function shareToEmail(link, count) {
            const subject = `${count} Matched Photos - AI Face Recognition`;
            const body = `Hi,

I found ${count} matching photos using AI Face Recognition and wanted to share them with you!

Download Link: ${link}

⚠️ IMPORTANT: This link expires soon, so download it as soon as possible!

The photos were automatically matched and organized using face recognition technology.

Enjoy!`;

            const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
            log('✉️ Opening email client...', 'info');
        }

        function showComparison(photo) {
            const modal = document.getElementById('comparisonModal');
            const content = document.getElementById('comparisonContent');
            
            content.innerHTML = `
                <div class="comparison-view">
                    <div>
                        <img src="${photo.url}" alt="Original">
                        <div class="label">Original</div>
                    </div>
                    <div>
                        <img src="${photo.enhancedUrl}" alt="Enhanced">
                        <div class="label">✨ AI Enhanced</div>
                    </div>
                </div>
                <p style="text-align: center; margin-top: 15px; color: #666;">
                    Confidence: ${photo.confidence}% | Click outside to close
                </p>
            `;
            
            modal.classList.add('active');
        }

        function closeModal() {
            document.getElementById('comparisonModal').classList.remove('active');
        }

        // Close modal on background click
        document.getElementById('comparisonModal').addEventListener('click', (e) => {
            if (e.target.id === 'comparisonModal') {
                closeModal();
            }
        });

        async function downloadMatches(enhanced = false) {
            if (matchedPhotos.length === 0) {
                alert('No matched photos to download!');
                return;
            }

            const type = enhanced ? 'enhanced' : 'original';
            log(`📦 Creating ${type} photos ZIP file...`, 'info');
            const zip = new JSZip();
            
            for (let i = 0; i < matchedPhotos.length; i++) {
                const photo = matchedPhotos[i];
                const fileToZip = enhanced && photo.enhancedFile ? photo.enhancedFile : photo.file;
                const prefix = enhanced ? 'enhanced_' : '';
                zip.file(prefix + fileToZip.name, fileToZip);
            }

            log('⬇️ Generating download...', 'info');
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `matched_faces_${type}_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log(`✅ ${type} photos download started!`, 'success');
        }

        function loadImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        }
