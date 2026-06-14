        // 全局变量
        let userId = null;
        let currentTestType = 'pre'; // 'pre' 或 'formal'
        let currentTestMode = 'single'; // 'single' 或 'dual'
        let currentTestIndex = 0;
        let trainover=false;
        let canclick=false;

        let trainPolicySingleFirst = true;

        let pretech_single=-1;
        let pretech_dual=-1;
        let formaltech_single=-1;
        let formaltech_dual=-1;

        let breakTimerId = null;      // setInterval id
        let breakTimeoutId = null;    // setTimeout id
        
        let testData = {
            prolific_id:'',

            pre_single: [],
            pre_dual: [],
            formal_single: [],
            formal_dual: [],
            train_single: [],
            train_text:[],
            group:-1,
            attention:[]
        };
        let testResults = {

            //记录实验结果
            pre_single: [],
            pre_dual: [],
            train_single: [],
            formal_single: [],
            formal_dual: [],
            //记录实验时间：时间应该是一个二维数组，做题时间&
            pre_single_time: [],
            pre_dual_time: [],
            train_single_time: [],
            formal_single_time: [],
            formal_dual_time: [],

            pre_single_score: 0,
            pre_dual_score: 0,
            formal_single_score: 0,
            formal_dual_score: 0,

            attention: ["null","null","null","null"],
        };
        let videoUrl = '';

        // 图片缩放相关变量
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let lastX = 0;
        let lastY = 0;
        let isDragging = false;
        //计时器
        // let timer = null;
        //多个计时器，用来计算用户读题时间
        let zoomTimerAll=0.0;
        const timers = {};
        const LIMIT = 20 * 60 * 1000; // 20 分钟


        // 交互日志：单一时间线。固定频率记录鼠标位置，关键行为即时插入 timeline。
        const interactionLog = {
            version: 4,
            session_start_epoch: Date.now(),
            session_start_iso: new Date().toISOString(),
            timeline: [],
            installed: false,
            sampleTimer: null,
            lastMouse: { x: null, y: null, buttons: 0 },
            lastWheelAt: 0,
            currentDrag: null,
            zoomOpenedAt: null,
            summary: {
                timeline_count: 0,
                sample_count: 0,
                mouse_down_count: 0,
                mouse_up_count: 0,
                drag_count: 0,
                wheel_count: 0,
                key_down_count: 0,
                key_up_count: 0,
                zoom_open_count: 0,
                zoom_close_count: 0,
                visibility_hidden_count: 0,
                page_view_count: 0,
                dropped_count: 0
            }
        };

        const INTERACTION_TRACKING = {
            sampleIntervalMs: 500,       // 0.5 秒采样一次鼠标位置；如需更轻量可改为 1000
            wheelMinIntervalMs: 200,     // 非 zoom 区域滚轮做轻度节流
            maxTimeline: 25000,          // 约可覆盖 2-3 小时，防止异常挂起导致 JSON 过大
            storeKeyValueOnInputs: false // 不保存输入框里的真实 key，降低隐私风险
        };

        function getActivePageId() {
            return document.querySelector('.page.active')?.id || null;
        }

        function isZoomModalOpen() {
            return document.getElementById('zoom-modal')?.style.display === 'flex';
        }

        function eventTargetLabel(e) {
            const el = e?.target;
            if (!el) return null;
            const tag = el.tagName ? el.tagName.toLowerCase() : null;
            const id = el.id ? `#${el.id}` : '';
            const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
            return `${tag || 'node'}${id}${cls}`;
        }

        function isTextEntryTarget(e) {
            const el = e?.target;
            if (!el) return false;
            const tag = (el.tagName || '').toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
        }

        function timelineSeconds() {
            return Math.round(performance.now()) / 1000;
        }

        function roundNumber(n, digits = 3) {
            if (typeof n !== 'number' || !Number.isFinite(n)) return n;
            const m = Math.pow(10, digits);
            return Math.round(n * m) / m;
        }

        function wheelDirection(deltaY) {
            if (deltaY < 0) return 'up';
            if (deltaY > 0) return 'down';
            return 'none';
        }

        function dragDirection(dx, dy) {
            const ax = Math.abs(dx);
            const ay = Math.abs(dy);
            if (ax < 20 && ay < 20) return 'none';
            const horiz = dx > 20 ? 'right' : (dx < -20 ? 'left' : '');
            const vert = dy > 20 ? 'down' : (dy < -20 ? 'up' : '');
            if (horiz && vert) return `${horiz}-${vert}`;
            if (horiz) return horiz;
            if (vert) return vert;
            return ax >= ay ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
        }

        function keyType(e) {
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return 'modifier';
            if (e.key && e.key.length === 1) return 'character';
            if (e.key) return 'control';
            return 'unknown';
        }

        function incrementTimelineSummary(type) {
            const s = interactionLog.summary;
            if (type === 'sample') s.sample_count++;
            else if (type === 'mouse_down') s.mouse_down_count++;
            else if (type === 'mouse_up') s.mouse_up_count++;
            else if (type === 'drag_end') s.drag_count++;
            else if (type === 'wheel') s.wheel_count++;
            else if (type === 'key_down') s.key_down_count++;
            else if (type === 'key_up') s.key_up_count++;
            else if (type === 'zoom_open') s.zoom_open_count++;
            else if (type === 'zoom_close') s.zoom_close_count++;
            else if (type === 'visibility' && document.hidden) s.visibility_hidden_count++;
            else if (type === 'page_view') s.page_view_count++;
        }

        function normalizeTimelineType(type) {
            if (type === 'mousedown') return 'mouse_down';
            if (type === 'mouseup') return 'mouse_up';
            if (type === 'keydown') return 'key_down';
            if (type === 'keyup') return 'key_up';
            if (type === 'visibilitychange') return 'visibility';
            if (type === 'zoom_wheel') return 'wheel';
            return type;
        }

        function appendTimeline(type, data = {}) {
            const normalized = normalizeTimelineType(type);
            if (interactionLog.timeline.length >= INTERACTION_TRACKING.maxTimeline) {
                interactionLog.summary.dropped_count++;
                return;
            }
            const record = {
                t: timelineSeconds(),
                ts: Date.now(),
                type: normalized,
                ...data
            };
            // 图片名、题号、答案等任务内容不写入 timestamp；这些仍由结果列保存。
            interactionLog.timeline.push(record);
            interactionLog.summary.timeline_count = interactionLog.timeline.length;
            incrementTimelineSummary(normalized);
        }

        // 兼容旧调用名。这里写入的是单一 timeline，不再写 samples/events 两个数组。
        function logInteraction(type, data = {}) {
            appendTimeline(type, data);
        }

        function sampleInteractionState() {
            appendTimeline('sample', {
                x: interactionLog.lastMouse.x,
                y: interactionLog.lastMouse.y,
                buttons: interactionLog.lastMouse.buttons,
                page: getActivePageId(),
                zoom: isZoomModalOpen(),
                scroll_x: window.scrollX,
                scroll_y: window.scrollY,
                visibility: document.visibilityState
            });
        }

        // 题目边界和答案已保存在结果列；timestamp 只保存行为时间线，因此这里保持空操作。
        function beginTrialLog() {}

        function buildTimestampPayload() {
            const endedAt = Date.now();
            return {
                version: interactionLog.version,
                sample_interval_ms: INTERACTION_TRACKING.sampleIntervalMs,
                started_at: interactionLog.session_start_epoch,
                started_iso: interactionLog.session_start_iso,
                ended_at: endedAt,
                ended_iso: new Date().toISOString(),
                duration_ms: endedAt - interactionLog.session_start_epoch,
                viewport: {
                    w: window.innerWidth,
                    h: window.innerHeight,
                    dpr: window.devicePixelRatio || 1
                },
                summary: interactionLog.summary,
                timeline: interactionLog.timeline
            };
        }

        function installInteractionTracking() {
            if (interactionLog.installed) return;
            interactionLog.installed = true;

            appendTimeline('session_start', {
                page: getActivePageId(),
                viewport_w: window.innerWidth,
                viewport_h: window.innerHeight,
                dpr: window.devicePixelRatio || 1
            });

            document.addEventListener('mousemove', (e) => {
                interactionLog.lastMouse = { x: e.clientX, y: e.clientY, buttons: e.buttons };
            }, { capture: true, passive: true });

            document.addEventListener('mousedown', (e) => {
                interactionLog.lastMouse = { x: e.clientX, y: e.clientY, buttons: e.buttons };
                appendTimeline('mouse_down', { x: e.clientX, y: e.clientY, button: e.button, buttons: e.buttons, page: getActivePageId(), zoom: isZoomModalOpen(), target: eventTargetLabel(e) });
            }, { capture: true, passive: true });

            document.addEventListener('mouseup', (e) => {
                interactionLog.lastMouse = { x: e.clientX, y: e.clientY, buttons: e.buttons };
                appendTimeline('mouse_up', { x: e.clientX, y: e.clientY, button: e.button, buttons: e.buttons, page: getActivePageId(), zoom: isZoomModalOpen(), target: eventTargetLabel(e) });
            }, { capture: true, passive: true });

            document.addEventListener('wheel', (e) => {
                // zoom 图片区域的滚轮由 handleZoom 在更新 scale 后记录，避免重复。
                const inZoomContainer = !!(e.target?.closest && e.target.closest('#zoom-container'));
                if (isZoomModalOpen() && inZoomContainer) return;
                const now = performance.now();
                if (now - interactionLog.lastWheelAt < INTERACTION_TRACKING.wheelMinIntervalMs) return;
                interactionLog.lastWheelAt = now;
                appendTimeline('wheel', {
                    x: e.clientX,
                    y: e.clientY,
                    direction: wheelDirection(e.deltaY),
                    delta_y: Math.round(e.deltaY),
                    delta_x: Math.round(e.deltaX),
                    delta_mode: e.deltaMode,
                    page: getActivePageId(),
                    zoom: isZoomModalOpen(),
                    target: eventTargetLabel(e)
                });
            }, { capture: true, passive: true });

            document.addEventListener('keydown', (e) => {
                appendTimeline('key_down', {
                    code: e.code,
                    key_type: keyType(e),
                    repeat: e.repeat,
                    text_target: isTextEntryTarget(e),
                    alt: e.altKey,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    meta: e.metaKey,
                    page: getActivePageId(),
                    target: eventTargetLabel(e)
                });
            }, { capture: true });

            document.addEventListener('keyup', (e) => {
                appendTimeline('key_up', {
                    code: e.code,
                    key_type: keyType(e),
                    text_target: isTextEntryTarget(e),
                    alt: e.altKey,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    meta: e.metaKey,
                    page: getActivePageId(),
                    target: eventTargetLabel(e)
                });
            }, { capture: true });

            document.addEventListener('visibilitychange', () => {
                appendTimeline('visibility', { state: document.visibilityState, hidden: document.hidden, page: getActivePageId() });
            });

            sampleInteractionState();
            interactionLog.sampleTimer = setInterval(sampleInteractionState, INTERACTION_TRACKING.sampleIntervalMs);
        }

        // 激活冷却函数
        function activateCooldown(seconds = 0.5) {
            if (timers['cooldown']) {clearTimeout(timers['cooldown']);} // 避免叠加计时器
            // canclick = false;
            canclick = false;
            timers['cooldown'] = setTimeout(() => {
                canclick = true;
            }, seconds * 1000);
        }



        function startTimer(id) {
            if (timers[id]) {
                console.warn(`计时器 ${id} 已存在`);
                return;
            }
            timers[id] = {
                start: Date.now(),
                timeout: setTimeout(() => {
                console.warn(`计时器 ${id} 超时自动销毁`);
                delete timers[id];
                }, LIMIT)
            };
        }

        function stopTimer(id) {
            const t = timers[id];
            if (!t) {
                console.warn(`计时器 ${id} 不存在或已被清理`);
                return null;
            }
            clearTimeout(t.timeout);
            const seconds = (Date.now() - t.start) / 1000;
            delete timers[id];
            return seconds;
        }

        function getProlific(){
            return null;
        }
        function instruction_click()
        {
            showAlert(
            "Confirm", 
            "Do you want to proceed to the formal test?", 
            "Yes", () => {goToPage('select-page')}, 
            "No", () => {}
            );
        }

        function showAlert(
        title, 
        message, 
        btn1Text = "OK", 
        btn1Callback = null, 
        btn2Text = null, 
        btn2Callback = null,
        htmlOrOpts = false   // ← 新增：既可传 boolean，也可传 { html: true }
        ) {
            // 解析 html 开关
            const html = (typeof htmlOrOpts === 'object' && htmlOrOpts !== null)
                ? !!htmlOrOpts.html
                : !!htmlOrOpts;

            // 标题：纯文本更安全
            document.getElementById("custom-alert-title").textContent = title;

            const msgEl = document.getElementById("custom-alert-message");
            if (html) {
                msgEl.innerHTML = message;           // 受信任内容
                msgEl.style.whiteSpace = "";
            } else {
                msgEl.textContent = message;         // 纯文本
                msgEl.style.whiteSpace = "pre-line"; // 支持 \n 换行
            }

            const alertBox = document.getElementById("custom-alert");
            const btn1 = document.getElementById("custom-alert-btn1");
            const btn2 = document.getElementById("custom-alert-btn2");

            // 按钮1
            btn1.textContent = btn1Text;
            btn1.onclick = () => {
                alertBox.style.display = "none";
                if (typeof btn1Callback === "function") btn1Callback();
            };

            // 按钮2（可选）
            if (btn2Text) {
                btn2.style.display = "inline-block";
                btn2.textContent = btn2Text;
                btn2.onclick = () => {
                alertBox.style.display = "none";
                if (typeof btn2Callback === "function") btn2Callback();
                };
            } else {
                btn2.style.display = "none";
                btn2.onclick = null;
            }

            alertBox.style.display = "flex";
        }

        function hideAlert() {
            const alertBox = document.getElementById("custom-alert");
            alertBox.style.display = "none";
        }

        function showShortBreak(durationSeconds = 120, onDone = null) {
        // 如果上一次还在跑，先清理
        if (breakTimerId) clearInterval(breakTimerId);
        if (breakTimeoutId) clearTimeout(breakTimeoutId);

        const alertBox = document.getElementById("custom-alert");
        const titleEl = document.getElementById("custom-alert-title");
        const msgEl = document.getElementById("custom-alert-message");
        const btn1 = document.getElementById("custom-alert-btn1");
        const btn2 = document.getElementById("custom-alert-btn2");

        titleEl.textContent = "Short break";

        // 渲染倒计时
        const format = (s) => {
            const mm = String(Math.floor(s / 60)).padStart(2, "0");
            const ss = String(s % 60).padStart(2, "0");
            return `${mm}:${ss}`;
        };

        let remaining = durationSeconds;

        // 建议用 HTML，方便加粗/样式；也可以 textContent
        msgEl.innerHTML = `Please take a short break.<br><br><strong>Time left: <span id="break-countdown">${format(remaining)}</span></strong>`;
        msgEl.style.whiteSpace = "";

        // 按钮：只给一个“提前结束”
        btn1.textContent = "End break";
        btn1.onclick = () => {
            // 手动结束
            cleanup();
            hideAlert();
            if (typeof onDone === "function") onDone({ reason: "manual" });
        };

        // 隐藏第二个按钮
        btn2.style.display = "none";
        btn2.onclick = null;

        // 显示弹窗
        alertBox.style.display = "flex";

        const countdownEl = document.getElementById("break-countdown");

        // 每秒更新
        breakTimerId = setInterval(() => {
            remaining -= 1;
            if (remaining < 0) remaining = 0;
            if (countdownEl) countdownEl.textContent = format(remaining);
        }, 1000);

        // 到点自动结束
        breakTimeoutId = setTimeout(() => {
            cleanup();
            hideAlert();
            if (typeof onDone === "function") onDone({ reason: "auto" });
        }, durationSeconds * 1000);

        function cleanup() {
            if (breakTimerId) {
            clearInterval(breakTimerId);
            breakTimerId = null;
            }
            if (breakTimeoutId) {
            clearTimeout(breakTimeoutId);
            breakTimeoutId = null;
            }
        }
        }






        function closeAlert() {
            document.getElementById("custom-alert").style.display = "none";
        }


        function showFeedbackForm() {
            const choice = document.getElementById("feedback-choice");
            if (choice) choice.style.display = "none";
            document.getElementById("feedback-form").style.display = "block";
        }

        async function submitFeedback() {
            // 采集 5 个问题的答案（均为可选）
            const q1 = document.querySelector('input[name="q1"]:checked')?.value || "";
            const q2 = document.querySelector('input[name="q2"]:checked')?.value || "";
            
            const q3_1 = "input:"+ document.getElementById("q3")?.value.trim() || ""
            const checkedQ3Options = document.querySelectorAll('input[name="q3-2"]:checked');
            const q3_2_values = Array.from(checkedQ3Options).map(checkbox => checkbox.value).join(',');
            const q3_2 = "check:" + q3_2_values;
            const q3 = q3_1 + q3_2;
            // const q4 = document.getElementById("q4")?.value.trim() || "";

            const q4_1 = "input:"+ document.getElementById("q4")?.value.trim() || ""
            const checkedQ4Options = document.querySelectorAll('input[name="q4-2"]:checked');
            const q4_2_values = Array.from(checkedQ4Options).map(checkbox => checkbox.value).join(',');
            const q4_2 = "check:" + q4_2_values;
            const q4 = q4_1 + q4_2;
            
            const q5 = document.getElementById("q5")?.value.trim() || "";
            // console.log(q1,q2,q3,q4,q5);

            const feedback = { q1, q2, q3, q4, q5 };

            try {
            const res = await fetch('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: userId, feedback })
            });
            if (!res.ok) throw new Error('Failed to send feedback data!');
                // console.log("Feedback submitted:", feedback);
                returnToProlific();
            } catch (err) {
            // alert('Error: ' + err.message);
                showAlert("Error", "Some Error Occurred. Please Try Again.("+err.message+")", "OK");
            }

            // 提交后隐藏表单，显示返回按钮
            // document.getElementById("feedback-form").style.display = "none";
            // const prol = document.getElementById("prolific-btn");
            // if (prol) prol.style.display = "inline-block";
        }

        function returnToProlific() {
            const btn = document.getElementById('prolific-btn');
            if (btn) {
                btn.textContent = 'Submitted';
                btn.disabled = true;
            }
            showAlert('Submitted', 'Thank you. Your feedback has been submitted.');
        }




        function pauseVideoAndReturn() {
            const video = document.getElementById("instructional-video");
            if (video && !video.paused) {
                video.pause();
            }
            // goToPage('select-page');
            startTrainTest();
            // releaseTrain();
        }

        function startPreloading(imageArrays, onComplete) {
            const urls = imageArrays.flat();
            let loaded = 0;
            const total = urls.length;

            // 建一个隐藏容器
            let hiddenDiv = document.getElementById("preload-container");
            if (!hiddenDiv) {
                hiddenDiv = document.createElement("div");
                hiddenDiv.id = "preload-container";
                hiddenDiv.style.display = "none";
                document.body.appendChild(hiddenDiv);
            }

            // 显示 loading 层
            document.getElementById("loading-screen").style.display = "flex";
            document.getElementById("loading-text").textContent = `Loading 0%`;
            document.getElementById("loading-bar").style.width = "0%";

            urls.forEach(url => {
                const img = new Image();
                img.onload = img.onerror = () => {
                loaded++;
                // 更新进度
                const percent = Math.round((loaded / total) * 100);
                document.getElementById("loading-text").textContent = `Loading ${percent}%`;
                document.getElementById("loading-bar").style.width = percent + "%";

                if (loaded === total) {
                    // 全部加载完成
                    document.getElementById("loading-screen").style.display = "none";
                    onComplete?.();
                }
                };
                img.src = url;
                hiddenDiv.appendChild(img);
            });
        }

        // 问卷数据
        let questionnaireList = [
            {
                "section": "1. User Information",
                "questions": [
                    {
                        "question": " Please select your age range:",
                        "type": "radio",
                        "id": "age",
                        "options": ["18-24", "25-34", "35-44", "45-54", "55-64", "Over 65","Prefer not to disclose"]
                    },
                    {
                        "question": "Please select your gender:",
                        "type": "radio",
                        "id": "gender",
                        "options": ["Male", "Female", "Non-binary", "Prefer not to disclose"]
                    },
                    {
                        "question": "Please select your country/region of birth:",
                        "type": "radio",
                        "id": "country",
                        "options":
                        ["Prefer not to disclose","UK","Germany","China", "Afghanistan", "Albania", "Algeria", "Angola", "Antigua & Barbuda", "Argentina", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Bermuda", "Bolivia", "Bosnia-Hercegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina-Faso", "Burma", "Burundi", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "Colombia", "Congo", "Costa Rica", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Estonia", "Ethiopia", "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France", "Gabon", "Georgia", "Ghana", "Gibraltar", "Greece", "Greenland", "Guatemala", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Kurdistan", "Kuwait", "Kyrgyzstan", "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg", "Macau", "Macedonia", "Mali", "Malta", "Maldive Islands", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nepal", "Netherlands", "New Zealand", "Niger", "Nigeria", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Republic of Ireland", "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "St Kitts & Nevis", "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikstan", "Tanzania", "Thailand", "Trinidad & Tobago", "Tunisia", "Turkey", "Turkmenistan", "UAE", "Uganda", "Ukraine", "Uruguay", "USA", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe","Other"]
                    },
                    {
                        "question": "Please select the option that best describes your ethnicity:",
                        "type": "radio",
                        "id": "ethnicity",
                        "options":
                        ["Asian","Black","Mixed","White","Other","Prefer not to disclose"]
                    },
                    {
                        "question": "Please select your highest level of education:",
                        "type": "radio",
                        "id": "education",
                        "options": ["Doctoral degree (including studying)", "Master's degree (including studying)", "Bachelor's degree (including studying)", "Pre-university education", "No formal education", "Prefer not to disclose"]
                    },
                    {
                        "question": "Please assess your experience with Information and Communication Technology (ICT):",
                        "type": "radio",
                        "id": "ICT",
                        "options": ["Beginner (I'm still learning the basics and often need help.)", "Intermediate (I'm comfortable with everyday programs like MS Office and email.)", "Advanced (I have tech skills beyond the basics like coding or data analysis.)", "Prefer not to disclose"]
                    },
                ]
            }
        ];
        const questionnaireConfidenceList = [
            {
                "section": "",
                "questions": [
                    {
                        "question": "1.Please estimate how many questions you answered correctly in the session you just completed (Single Images).",
                        "type": "radio",
                        "id": "confidence1",
                        "options": []
                    },
                    {
                        "question": "2.Overall, how confident did you feel about your answers in the session you just completed?",
                        "type": "radio",
                        "id": "confidence3",
                        "options": ["Very high", "High", "Moderate", "Low", "Very low"]
                    },
                    {
                        "question": "3.Overall, how stressed did you feel during the session you just completed?",
                        "type": "radio",
                        "id": "confidence4",
                        "options": ["Very high", "High", "Moderate", "Low", "Very low"]
                    },
                ]
            },
        ];

        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', () => {
            showPrivacyPolicy('PIS');
            installInteractionTracking();
            // showPrivacyPolicy('video-page');
            // goToPage('completed-page');

            // 生成问卷
            renderQuestionnaire();
            // renderQuestionnaire_p();
            document.getElementById('q3-other-checkbox').addEventListener('change', function() {
                // 获取对应的文本输入框
                const q3Textarea = document.getElementById('q3');
                if (this.checked) {
                    q3Textarea.style.display = 'block';
                } else {
                    q3Textarea.style.display = 'none';
                }
            });
            document.getElementById('q4-other-checkbox').addEventListener('change', function() {
                // 获取对应的文本输入框
                const q4Textarea = document.getElementById('q4');
                if (this.checked) {
                    q4Textarea.style.display = 'block';
                } else {
                    q4Textarea.style.display = 'none';
                }
            });
            
            // 绑定事件监听器
            // document.getElementById('info-button').addEventListener('click', () => goToPage('questionnaire-page'));
            // document.getElementById('train-button').addEventListener('click', startTrainTest);
            document.getElementById('pre-test-button').addEventListener('click', startPreTest);
            document.getElementById('video-button').addEventListener('click', () => {
                goToPage('video-page');
                showAlert("Training Session", "You will now watch a short training video and complete some practice tasks. After training, you can move on to the Post-training Detection Session.");
                document.getElementById('video-source').src = videoUrl;
                document.getElementById('instructional-video').load();
            });
            // document.getElementById('video-button').addEventListener('click', () => {
            //     goToPage('video-page');
            //     showAlert("Training Session", "You will now watch a short training video and complete some practice tasks. You can repeat this training session until you have mastered the task, then move on to the Deepfake Detection Session 2.");
            //     document.getElementById('video-source').src = videoUrl;
            //     document.getElementById('instructional-video').load();
            // });
            document.getElementById('final-test-button').addEventListener('click', startFinalTest);
            document.getElementById('submit-questionnaire').addEventListener('click', submitQuestionnaire);
            // document.getElementById('submit-confidence').addEventListener('click', submitConfidence);
            // document.getElementById('single-test-next').addEventListener('click', nextSingleTest);
            // document.getElementById('dual-test-next').addEventListener('click', nextDualTest);
            
            // 绑定缩放模态框事件
            document.getElementById('zoom-container').addEventListener('mousedown', startDrag);
            document.getElementById('zoom-container').addEventListener('mousemove', drag);
            document.getElementById('zoom-container').addEventListener('mouseup', endDrag);
            document.getElementById('zoom-container').addEventListener('wheel', handleZoom);


            const radioButtons = document.querySelectorAll('input[name="policy-acknowledgment"]');
            const continueButton = document.getElementById('policy-image-btn');
            
            // 监听单选框变化
            radioButtons.forEach(radio => {
                radio.addEventListener('change', function() {
                    // 只有选择"同意"时才启用继续按钮
                    continueButton.disabled = this.value !== 'agree';
                    
                    // 可以在这里添加额外的逻辑，比如当选择不同意时显示提示信息
                    if (this.value === 'disagree') {
                        // alert('You must agree to the policy to continue.');
                    }
                });
            });

        });
    
    // 假设的页面跳转函数
    function goToPage(pageId) {
        // 实际项目中实现页面跳转逻辑
        // console.log(`Navigating to ${pageId}`);
        // 例如: document.getElementById(pageId).classList.add('active');
        //      document.getElementById('policy-page').classList.remove('active');
    }

        (function(){
            const bar = document.getElementById('privacy-notice');
            const ok  = document.getElementById('privacy-ok');
            const pageContent = document.querySelector('.page-content');

            // 仅在页面加载时显示（无任何存储）
            bar.hidden = false;
            pageContent && pageContent.classList.add('has-privacy-bar');

            ok.addEventListener('click', () => {
                bar.classList.add('closing');
                setTimeout(()=>{
                bar.hidden = true;
                pageContent && pageContent.classList.remove('has-privacy-bar');
                }, 150);
            });
            })();
        
        //处理政策页面
        // function showPrivacyPolicy_text(){
        //     closePolicyTextOverlay();
        // }

        function loadPolicyContent(file, nextAction) {
            fetch(file)
                .then(res => res.text())
                .then(html => {
                document.getElementById('policy-text').innerHTML = html;
                document.getElementById('policy-image-btn').onclick = nextAction;
                });
        }

        function showPrivacyPolicy(inp) {
            const title = document.getElementById('policy-image-title');
            const note = document.getElementById('policy-image-note');
            const btn = document.getElementById('policy-image-btn');
            const ratio = document.getElementById('cf-radio-option');

            if (inp === 'PIS') {
                title.textContent = 'Participant Information Sheet';
                loadPolicyContent('pis.html', () => showPrivacyPolicy('CF'));
                ratio.style.display = 'none';
                note.style.display = 'none';
                btn.disabled = false;
            } else {
                title.textContent = 'Consent Form';
                loadPolicyContent('cf.html', () => goToPage('questionnaire-page'));
                note.style.display = 'none';
                ratio.style.display = 'block';
                btn.disabled = true;
            }
            goToPage('policy-page');
        }


          // 打开/关闭“文字版政策”覆盖层（不切换 .active，不丢页面状态）
        function openPolicyTextOverlay(){
            const page = document.getElementById('policy-text-page');
            page.classList.add('overlay-open');
            document.body.classList.add('no-scroll');
        }
        function closePolicyTextOverlay(){
            const page = document.getElementById('policy-text-page');
            page.classList.remove('overlay-open');
            document.body.classList.remove('no-scroll');
        }
        
        
        //问卷辅助函数
        function escapeHtml(s){
            const d = document.createElement('div');
            d.textContent = s ?? '';
            return d.innerHTML;
            }

        function renderQuestionnaire() {
        const container = document.getElementById('questionnaire-content');
        container.innerHTML = '';

        questionnaireList.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'question-section';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = section.section;
            sectionDiv.appendChild(sectionTitle);

            if (sectionTitle.textContent === "1. Confirm" && noticeImageUrl) {
                    const noticeWrap = document.createElement('div');
                    noticeWrap.className = 'notice-wrap';

                    const img = document.createElement('img');
                    img.src = noticeImageUrl;
                    img.alt = 'User Notice';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.className = 'notice-img';

                    noticeWrap.appendChild(img);
                    sectionDiv.appendChild(noticeWrap);
                }

            section.questions.forEach(question => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question';

            const questionText = document.createElement('p');
            if(question.question=="[reserved]"){
                questionText.textContent = `I confirm that the Prolific ID ${getProlific()} is correct. If this is not your ID, please return to Prolific and start the study again. Do not proceed.`;
                question.options=[`I Confirm my ID is: ${getProlific()}`]
            }else{
                questionText.textContent = question.question;
            }
            questionDiv.appendChild(questionText);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'options';

            if (question.type === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = question.id;
                input.required = true;
                optionsDiv.appendChild(input);

            } else if (question.type === 'radio') {
                const OPTS = Array.isArray(question.options) ? question.options : [];
                const USE_SELECT = OPTS.length > 6; // 阈值用下拉

                if (USE_SELECT) {
                const select = document.createElement('select');
                select.id = question.id;           // 关键：与原单选使用相同 id
                select.required = true;

                // 占位项
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select an option';
                placeholder.disabled = true;
                placeholder.selected = true;
                select.appendChild(placeholder);

                OPTS.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt;
                    o.innerHTML = escapeHtml(opt);
                    select.appendChild(o);
                });

                optionsDiv.appendChild(select);

                } else {
                // 原有的单选按钮渲染
                OPTS.forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'option';

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = question.id;  // 关键：name = question.id
                    radio.value = option;
                    radio.id = `${question.id}_${index}`;
                    radio.required = true;

                    const label = document.createElement('label');
                    label.htmlFor = radio.id;
                    label.textContent = option;

                    optionDiv.appendChild(radio);
                    optionDiv.appendChild(label);
                    optionsDiv.appendChild(optionDiv);
                });
                }
            }

            questionDiv.appendChild(optionsDiv);
            sectionDiv.appendChild(questionDiv);
            });

            container.appendChild(sectionDiv);
        });
        }

        function renderQuestionnaire_p() {
            const total = testData[`${currentTestType}_single`]?.length || 0;
            const opts = Array.from({ length: total + 1 }, (_, i) => String(i));
            questionnaireConfidenceList[0].questions[0].options = opts;
            questionnaireList=questionnaireConfidenceList;
            renderQuestionnaire();
        }

        function validateQuestionnaire() {
        document.querySelectorAll('.question.missing').forEach(q => q.classList.remove('missing'));
        let firstMissing = null;

        questionnaireList.forEach(section => {
            section.questions.forEach(question => {
            let ok = false;

            if (question.type === 'text') {
                const input = document.getElementById(question.id);
                ok = input && input.value.trim() !== '';
                if (!ok && input) firstMissing = firstMissing || input.closest('.question');

            } else if (question.type === 'radio') {
                const selectEl = document.getElementById(question.id); // 若为下拉，此元素存在
                if (selectEl && selectEl.tagName === 'SELECT') {
                ok = selectEl.value !== '';
                if (!ok) firstMissing = firstMissing || selectEl.closest('.question');
                } else {
                const selected = document.querySelector(`input[name="${question.id}"]:checked`);
                ok = !!selected;
                if (!ok) {
                    const anyOption = document.querySelector(`input[name="${question.id}"]`);
                    if (anyOption) firstMissing = firstMissing || anyOption.closest('.question');
                }
                }
            }

            if (!ok) {
                const qEl =
                (question.type === 'text'
                    ? document.getElementById(question.id)?.closest('.question')
                    : (document.getElementById(question.id)?.closest('.question') // select 情况
                    || document.querySelector(`input[name="${question.id}"]`)?.closest('.question'))
                );
                if (qEl) qEl.classList.add('missing');
            }
            });
        });

        if (firstMissing) {
            firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // alert();
            showAlert('Warning','Please complete all the questions before attempting to submit.');
            return false;
        }
        return true;
        }


        // === 工具：洗牌（Fisher–Yates）===
        function shuffleInPlace(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }
        function shuffledCopy(arr) {
            const a = Array.isArray(arr) ? arr.slice() : [];
            shuffleInPlace(a);
            return a;
        }

        // === 工具：构建 dual（real+fake 成对，且内部顺序随机）===
        function buildDualPairs(realArr, fakeArr) {
            const real = shuffledCopy(realArr);
            const fake = shuffledCopy(fakeArr);
            const n = Math.min(real.length, fake.length);
            const pairs = [];
            for (let i = 0; i < n; i++) {
                // 50% 概率 [real, fake] 或 [fake, real]
                if (Math.random() < 0.5) pairs.push([real[i], fake[i]]);
                else pairs.push([fake[i], real[i]]);
            }
            // （可选）把整组 pair 再打乱一次，进一步随机化出场顺序
            shuffleInPlace(pairs);
            return pairs;
        }
        function randomSwapCorresponding(arr1, arr2, p = 0.5, mutate = false) {
            if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
                throw new TypeError("arr1 和 arr2 都必须是数组");
            }
            if (typeof p !== "number" || p < 0 || p > 1) {
                throw new RangeError("p 必须是 0 到 1 之间的数");
            }

            const a = mutate ? arr1 : arr1.slice();
            const b = mutate ? arr2 : arr2.slice();
            const n = Math.min(a.length, b.length);

            for (let i = 0; i < n; i++) {
                if (Math.random() < p) {
                const tmp = a[i];
                a[i] = b[i];
                b[i] = tmp;
                }
            }
            return { a, b };
        }
 
        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // === 适配后端字段到前端 testData（单组、单图-only；保留 legacy fake_split/real_split 兼容）===
        function applyAssignData(assignData) {
            testData.group = assignData.group ?? 0;

            const database = assignData.database || "https://jctqmbsxufpqylqbouwg.supabase.co/storage/v1/object/public/gbucket/";
            const withBase = (path) => {
                if (!path) return path;
                if (/^https?:\/\//.test(path)) return path;
                return database + path;
            };

            const buildSingleList = (fakeArr, realArr) => {
                const fake = Array.isArray(fakeArr) ? fakeArr : [];
                const real = Array.isArray(realArr) ? realArr : [];
                const n = Math.min(fake.length, real.length);
                const out = [];
                for (let i = 0; i < n; i++) {
                    out.push(withBase(fake[i]), withBase(real[i]));
                }
                return out;
            };

            let pre_single = [];
            let final_single = [];

            // 新格式：后端显式返回 pre/post 四个数组。
            if (Array.isArray(assignData.pre_fake) || Array.isArray(assignData.post_fake)) {
                pre_single = buildSingleList(assignData.pre_fake, assignData.pre_real);
                final_single = buildSingleList(assignData.post_fake || assignData.formal_fake || assignData.final_fake,
                                               assignData.post_real || assignData.formal_real || assignData.final_real);
            } else {
                // 旧格式 fallback：fake_split/real_split 前半段为 post/formal，后半段为 pre。
                const fakeSplit = Array.isArray(assignData.fake_split) ? assignData.fake_split.slice() : [];
                const realSplit = Array.isArray(assignData.real_split) ? assignData.real_split.slice() : [];
                const n = Math.min(fakeSplit.length, realSplit.length);
                const half = Math.floor(n / 2);
                final_single = buildSingleList(fakeSplit.slice(0, half), realSplit.slice(0, half));
                pre_single = buildSingleList(fakeSplit.slice(half), realSplit.slice(half));
            }

            testData.pre_single = shuffledCopy(pre_single);
            testData.formal_single = shuffledCopy(final_single);
            testData.pre_dual = [];
            testData.formal_dual = [];

            testData.train_single = Array.isArray(assignData.train_examples)
                ? assignData.train_examples.map(withBase)
                : [];
            testData.train_text = Array.isArray(assignData.train_text) ? assignData.train_text : [];

            const attentionSingle = withBase("attention_test/pre_single_fake.png");
            testData.attention = [attentionSingle];

            if (testData.pre_single.length > 0) {
                pretech_single = getRandomInt(0, testData.pre_single.length);
                testData.pre_single.splice(pretech_single, 0, attentionSingle);
            }
            if (testData.formal_single.length > 0) {
                formaltech_single = getRandomInt(0, testData.formal_single.length);
                testData.formal_single.splice(formaltech_single, 0, attentionSingle);
            }

            if (testData.pre_single.length === 0 || testData.formal_single.length === 0) {
                showAlert('Warning','There is a data assignment issue. Please contact the admin.');
            }

            const allImages = [testData.pre_single, testData.formal_single, testData.train_single, testData.attention];
            startPreloading(allImages, () => {
                goToPage('introduction-page');
            });
        }
        
        // 提交问卷并握手
        async function submitQuestionnaire() {
            // 先做完整性校验
            
            if (!validateQuestionnaire()) return;
            
            // showLoading();
            
            // 收集问卷数据
            // const questionnaireData = {};
            // questionnaireList.forEach(section => {
            //     section.questions.forEach(question => {
            //         if (question.type === 'text') {
            //             questionnaireData[question.id] = document.getElementById(question.id).value;
            //         } else if (question.type === 'radio') {
            //             const selected = document.querySelector(`input[name="${question.id}"]:checked`);
            //             questionnaireData[question.id] = selected ? selected.value : '';
            //         }
            //     });
            // });
            // 收集问卷数据
            const questionnaireData = {};
            questionnaireList.forEach(section => {
            section.questions.forEach(question => {
                if (question.type === 'text') {
                questionnaireData[question.id] = document.getElementById(question.id).value;

                } else if (question.type === 'radio') {
                const selectEl = document.getElementById(question.id);
                if (selectEl && selectEl.tagName === 'SELECT') {
                    questionnaireData[question.id] = selectEl.value || '';
                } else {
                    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
                    questionnaireData[question.id] = selected ? selected.value : '';
                }
                }
            });
            });

            // console.log("questionnaireData-before:",questionnaireData);
            if(userId!=null)
            {
                try {
                    // console.log("questionnaireData:",questionnaireData);
                    // console.log("running-------------------------");
                    // 发送测试数据
                    const assignResponse = await fetch('/confidence', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: userId, stage: currentTestType, questionnaire: questionnaireData })
                    });
                    
                    if (!assignResponse.ok) throw new Error('Failed to send confidence data');
                    
                    if(currentTestType === 'formal')
                    {
                        // console.log("formal:",testResults.pre_single_score,testResults.pre_dual_score,testResults.formal_single_score,testResults.formal_dual_score);
                        const preTotal = testData.pre_single.length;
                        const formalTotal = testData.formal_single.length;
                        document.getElementById('final-score').innerHTML = `Your Performance Summary:<br>
                        • Pre-training Detection Session (Single Images): ${testResults.pre_single_score + (testResults.attention[0]=='yes'?1:0)} / ${preTotal}<br>
                        • Post-training Detection Session (Single Images):  ${testResults.formal_single_score + (testResults.attention[2]=='yes'?1:0)} / ${formalTotal}`;
                        submitTestResults2();
                        goToPage('completed-page');
                    }
                    else{
                        // 激活短休息 2 分钟
                        goToPage('select-page');
                        showShortBreak(120, ({ reason }) => {
                        // console.log("break ended:", reason); // "auto" or "manual"
                        });
                    }

                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
            else
            {
                try {
                    // 先握手获取用户ID
                    const handshakeResponse = await fetch('/handshake', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!handshakeResponse.ok) throw new Error('Handshake failed');
                    
                    const handshakeData = await handshakeResponse.json();
                    userId = handshakeData.uid;
                    document.getElementById('userinfo').innerText = `User [ ${userId} ] Operating`;
                    

                    // 获取测试数据
                    const assignResponse = await fetch('/assign', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: userId, questionnaire: questionnaireData })
                    });
                    
                    if (!assignResponse.ok) throw new Error('Failed to get test data');
                    
                    const assignData = await assignResponse.json();

                    //看看我们的设置是否是成功的
                    // console.log(assignData);
                    
                    applyAssignData(assignData);
                    videoUrl = assignData.video_url;

                    // 单组单图-only：保留变量以兼容旧代码，但流程始终走 single。
                    trainPolicySingleFirst = true;
                    // console.log("train:",trainPolicySingleFirst);


                    // console.log(videoUrl);
                    

                    // 启用其他按钮
                    
                    
                    // document.getElementById('info-button').disabled = true;
                    document.getElementById('pre-test-button').disabled = false;
                    // document.getElementById('video-button').disabled = false;
                    // document.getElementById('final-test-button').disabled = false;
                    
                    goToPage('select-page');
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        // 开始预测试
        function startPreTest() {
            showAlert(
                "Performance Bonus!",
                `
                <p>An extra bonus is available for the top 30% of performers <b>within your assigned group</b>, based on your total score.</p>
                <p><b>· Top 10% of performers:</b> Earn an extra <b>£10</b> bonus.</p>
                <p><b>· Ranks 10% - 30%:</b> Earn an extra <b>£5</b> bonus.</p>
                <p>Answer carefully to maximize your score!</p>
                `,
                "OK",
                null,
                null,
                null,
                true
            );
            currentTestType = 'pre';
            startSingleTest();
        }

        // 开始训练
        function startTrainTest() {
            // activateCooldown();
            currentTestType = 'train';
            startSingleTest();
        }

        // 开始最终测试
        function startFinalTest() {
            showAlert(
                "Performance Bonus!",
                `
                <p>An extra bonus is available for the top 30% of performers <b>within your assigned group</b>, based on your total score.</p>
                <p><b>· Top 10% of performers:</b> Earn an extra <b>£10</b> bonus.</p>
                <p><b>· Ranks 10% - 30%:</b> Earn an extra <b>£5</b> bonus.</p>
                <p>Answer carefully to maximize your score!</p>
                `,
                "OK",
                null,
                null,
                null,
                true
            );
            currentTestType = 'formal';
            startSingleTest();
        }

        // 开始单图测试
        function startSingleTest() {
            currentTestMode = 'single';
            currentTestIndex = 0;
            if(currentTestType=='train'){
                goToPage('train-page');
                loadSingleTestImage();
                document.getElementById('train-title').textContent = 
                    `Practice tasks`;
                updateSingleTestProgress();
            }
            else{
                goToPage('single-test-page');
                loadSingleTestImage();
                // 更新标题
                // document.getElementById('single-test-title').textContent = 
                //     `Follow-up Testing: Single Image`;
                 document.getElementById('single-test-title').textContent = 
                    `${currentTestType === 'pre' ? 'Pre-training Detection Session' : (currentTestType === 'formal' ? 'Post-training Detection Session' : 'Train')}: Single Image`;
                updateSingleTestProgress();        
            }
        }


        // 在指定 img 上显示加载动画，等图片 decode 完再淡入显示
        // function setImageWithLoader(imgId, url){
        //     const img = document.getElementById(imgId);
        //     if (!img || !url) return;

        //     // 找到或创建覆盖层
        //     const container = img.closest('.image-container') || img.parentElement;
        //     let overlay = container.querySelector('.loading-overlay');
        //     if (!overlay) {
        //         overlay = document.createElement('div');
        //         overlay.className = 'loading-overlay';
        //         overlay.innerHTML = '<div class="spinner"></div>';
        //         container.appendChild(overlay);
        //     }

        //     // 显示覆盖层、隐藏图片
        //     overlay.style.display = 'flex';
        //     img.classList.add('img-loading');

        //     // 离屏预载 + decode，准备好后一次性切换
        //     const pre = new Image();
        //     pre.decoding = 'async';
        //     pre.loading  = 'eager';
        //     pre.src = url;

        //     const done = pre.decode ? pre.decode().catch(()=>{}) : Promise.resolve();

        //     done.finally(() => {
        //         // 切图并在下一帧淡入，随后隐藏覆盖层
        //         img.src = pre.src;
        //         requestAnimationFrame(() => {
        //         img.classList.remove('img-loading');
        //         overlay.style.display = 'none';
        //         });
        //     });
        // }
        function setImageWithLoader(imgId, url){
            const img = document.getElementById(imgId);
            if (!img || !url) return;

            // 找到或创建覆盖层
            const container = img.closest('.test-image') || img.parentElement;
            let overlay = container.querySelector('.loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="spinner"></div>';
                container.appendChild(overlay);
            }

            // 显示覆盖层、隐藏图片
            overlay.style.display = 'flex';
            img.classList.add('img-loading');

            // 离屏预载 + decode，准备好后一次性切换
            const pre = new Image();
            pre.decoding = 'async';
            pre.loading  = 'eager';
            pre.src = url;

            const done = pre.decode ? pre.decode().catch(()=>{}) : Promise.resolve();

            done.finally(() => {
                // 切图并在下一帧淡入，随后隐藏覆盖层
                img.src = pre.src;
                requestAnimationFrame(() => {
                img.classList.remove('img-loading');
                overlay.style.display = 'none';
                });
            });
        }

        // 批量并行：双图同时加载并一起淡入（更丝滑）
        function setDualImagesWithLoader(id1, url1, id2, url2){
        const p1 = new Promise(res => setImageWithLoader(id1, url1) || res());
        const p2 = new Promise(res => setImageWithLoader(id2, url2) || res());
        // 这里不需要额外 then；两个各自处理、各自淡入即可
        }


        // 加载单图测试图片
        function loadSingleTestImage() {
            //不要太块的计时器
            activateCooldown();
            //不管在那个页面，应该都是需要这个来加载的：
            //我们先启动一个计时器来试一下效果
            startTimer('single');
            zoomTimerAll=0.0;
            if(currentTestType=='train'){
                const imageUrl = testData[`train_single`][currentTestIndex];
                // document.getElementById('train-image').src = imageUrl;
                setImageWithLoader('train-image', imageUrl);
            }
            else{
                const imageUrl = testData[`${currentTestType}_single`][currentTestIndex];
                // document.getElementById('single-test-image').src = imageUrl;
                setImageWithLoader('single-test-image', imageUrl);
            }
            beginTrialLog();
        }

        // 提交单图测试结果
        function submitSingleTestResult(isReal) {
            

            if(!canclick)
            {
                // alert('Too fast! Please answer the questions carefully.');
                showAlert('Too fast!','Please answer the questions carefully.');
                return
            }
            
            //这里应该在所有的内容都全部完成了之后在进行计时间
            time=stopTimer('single');
            // console.log("single test time is :",time);
            
            // console.log(testData[`${currentTestType}_single`]);
            // console.log("currentTestType is :",currentTestType," currentTestIndex is :",currentTestIndex);
            if(currentTestType=="pre"&&currentTestIndex==pretech_single)
            {
                if(isReal==0)
                {
                    testResults.attention[0] = 'yes';
                }
                else
                {
                    testResults.attention[0] = 'no';
                }
            }
            else if(currentTestType=="formal"&&currentTestIndex==formaltech_single)
            {
                if(isReal==0)
                {
                    testResults.attention[2] = 'yes';
                }
                else
                {
                    testResults.attention[2] = 'no';
                }
            }
            else
            {
                if(currentTestType !=='train' && testData[`${currentTestType}_single`][currentTestIndex].includes('Real')&& isReal==1)
                {
                    testResults[`${currentTestType}_single_score`]+=1;
                    //console.log(`${currentTestType}_single_score`);
                    //console.log(testResults[`${currentTestType}_single_score`]);
                }
                if(currentTestType !=='train' && testData[`${currentTestType}_single`][currentTestIndex].includes('Fake')&& isReal==0)
                {
                    testResults[`${currentTestType}_single_score`]+=1;
                    //console.log(`${currentTestType}_single_score`);
                    //console.log(testResults[`${currentTestType}_single_score`]);
                }
            }
            // console.log("now test results is :",testResults.attention);


            // 保存结果 (1 = 真实, 0 = 伪造)
            testResults[`${currentTestType}_single`].push({
                image: testData[`${currentTestType}_single`][currentTestIndex],
                result: isReal,
                // timestamp: new Date().toISOString(),
                timeall:time,
                zoomtime:zoomTimerAll
                //把两个时间都一起记录下来
            });
            
            // 检查是否完成所有单图测试
            if (currentTestIndex >= testData[`${currentTestType}_single`].length - 1) {
                if(currentTestType=='train'){
                    submitTestResults(currentTestType);
                    document.getElementById('final-test-button').disabled = false;
                    goToPage('select-page');
                }
                else{
                    submitTestResults(currentTestType);
                    renderQuestionnaire_p();
                    if (currentTestType === 'pre') {
                        goToPage('questionnaire-page');
                        document.getElementById('pre-test-button').disabled = true;
                        document.getElementById('video-button').disabled = false;
                        document.getElementById('final-test-button').disabled = true;
                    } else {
                        goToPage('questionnaire-page');
                        document.getElementById('pre-test-button').disabled = true;
                        document.getElementById('video-button').disabled = true;
                        document.getElementById('final-test-button').disabled = true;
                    }
                }
            } else {
                // 进行下一个单图测试
                currentTestIndex++;
                loadSingleTestImage();
                updateSingleTestProgress();
            }


        }

        // 下一个单图测试
        function nextSingleTest() {
            // 未选择时提示
            alert('Please select whether the image is real or fake.');
        }

        // 更新单图测试进度
        function updateSingleTestProgress() {
            if(currentTestType=='train'){
                const text=document.getElementById('descipt-train')
                
                if(currentTestIndex%2==0){
                    text.textContent=`Please carefully examine and determine whether this picture is real or fake.`;
                    document.getElementById('train-left-button').textContent = `FAKE`;
                    document.getElementById('train-right-button').textContent = `REAL`;
                    
                    document.getElementById('train-left-button').setAttribute('class', 'test-button fake-button');
                    document.getElementById('train-right-button').setAttribute('class', 'test-button real-button');
                }
                else{
                    text.textContent = `${testData[`train_text`][currentTestIndex]}`;
                    document.getElementById('train-left-button').textContent = `NEXT`;
                    document.getElementById('train-right-button').textContent = `NEXT`;
                    
                    document.getElementById('train-left-button').setAttribute('class', 'test-button next-button');
                    document.getElementById('train-right-button').setAttribute('class', 'test-button next-button');
                }
            }
            else{
                // document.getElementById('single-test-progress').textContent = 
                //     `Progress: ${currentTestIndex + 1}/${testData[`${currentTestType}_single`].length} <br>Please carefully examine and determine whether this picture is real or fake.`;
                const el = document.getElementById('single-test-progress');
                if(currentTestType=='pre')
                {
                    // if(currentTestIndex==pretech_single)
                    // {
                    //     el.innerHTML = `Please carefully examine and determine whether this picture is real or fake.`;
                    // }
                    // else
                    // {
                        el.innerHTML = `Question: ${currentTestIndex + 1}/${testData[`${currentTestType}_single`].length}<br>
                        Please carefully examine and determine whether this picture is real or fake.`;
                    // }
                }
                else
                {
                    // if(currentTestIndex==formaltech_single)
                    // {
                    //     el.innerHTML = `Please carefully examine and determine whether this picture is real or fake.`;
                    // }
                    // else
                    // {
                        el.innerHTML = `Question: ${currentTestIndex + 1}/${testData[`${currentTestType}_single`].length}<br>
                        Please carefully examine and determine whether this picture is real or fake.`;
                    // }
                }
            }
        }

        // 开始双图测试
        function startDualTest() {
            currentTestMode = 'dual';
            currentTestIndex = 0;
            loadDualTestImages();
            goToPage('dual-test-page');
            
            // 更新标题
            // document.getElementById('dual-test-title').textContent = 
            //     `Follow-up Testing: Side by Side`;
            document.getElementById('dual-test-title').textContent = 
                `${currentTestType === 'pre' ? 'Follow-up Testing Session 1' : 'Follow-up Testing Session 2'}: Side by Side`;
            updateDualTestProgress();
        }

        // 加载双图测试图片
        function loadDualTestImages() {
            //不要太块的计时器
            activateCooldown();

            startTimer('dual');
            zoomTimerAll=0.0;
            const images = testData[`${currentTestType}_dual`][currentTestIndex];
            // document.getElementById('dual-test-image1').src = images[0];
            // document.getElementById('dual-test-image2').src = images[1];
            setImageWithLoader('dual-test-image1', images[0]);
            setImageWithLoader('dual-test-image2', images[1]);
            
        }

        // 提交双图测试结果
        function submitDualTestResult(imageNumber) {
            if(!canclick)
            {
                // alert('Too FAST! ');
                showAlert('Too fast!','Please answer the questions carefully.');
                return
            }
            
            time = stopTimer("dual");
            // console.log("dual time is :",time);
            // activateCooldown();
            
            // console.log("currentTestType is :",currentTestType," currentTestIndex is :",currentTestIndex);

            if(currentTestType=="pre"&&currentTestIndex==pretech_dual)
            {
                if(imageNumber==0)
                {
                    testResults.attention[1] = 'no';
                }
                else
                {
                    testResults.attention[1] = 'yes';
                }
            }
            else if(currentTestType=="formal"&&currentTestIndex==formaltech_dual)
            {
                if(imageNumber==0)
                {
                    testResults.attention[3] = 'no';
                }
                else
                {
                    testResults.attention[3] = 'yes';
                }
            }
            else
            {
                if(testData[`${currentTestType}_dual`][currentTestIndex][imageNumber].includes('Real'))
                {
                    testResults[`${currentTestType}_dual_score`]++;
                }
            }
            // console.log("now test results is :",testResults.attention);

            
            // 保存结果 (记录哪张图被标记为伪造)
            testResults[`${currentTestType}_dual`].push({
                images: testData[`${currentTestType}_dual`][currentTestIndex],
                result: { choose: imageNumber},
                // timestamp: new Date().toISOString()
                timeall:time,
                zoomtime:zoomTimerAll
            });
            
            // 检查是否完成所有双图测试
            if (currentTestIndex >= testData[`${currentTestType}_dual`].length - 1) {
                // 双图测试完成，提交结果
                
                if(trainPolicySingleFirst)
                {
                    submitTestResults(currentTestType);
                    renderQuestionnaire_p();
                    
                    // 如果是预测试，完成后显示视频页面
                    if (currentTestType === 'pre') {
                        goToPage('questionnaire-page');
                        document.getElementById('video-source').src = videoUrl;
                        document.getElementById('instructional-video').load();
                        // document.getElementById('video-button').disabled = false;
                        // document.getElementById('final-test-button').disabled = false;
                        // document.getElementById('info-button').disabled = true;
                        // document.getElementById('train-button').disabled = true;
                        document.getElementById('pre-test-button').disabled = true;
                        // document.getElementById('video-button').disabled = false;
                        document.getElementById('final-test-button').disabled = false;
                    } else {
                        // 如果是最终测试，全部完成
                        goToPage('questionnaire-page');
                        // document.getElementById('info-button').disabled = true;
                        document.getElementById('pre-test-button').disabled = true;
                        // document.getElementById('video-button').disabled = false;
                        document.getElementById('final-test-button').disabled = true;
                    }
                }
                else{
                    startSingleTest();
                }
            } else {
                // 进行下一个双图测试
                currentTestIndex++;
                loadDualTestImages();
                updateDualTestProgress();
            }
        }

        // 下一个双图测试
        function nextDualTest() {
            // 未选择时提示
            alert('Too fast! Please answer the questions carefully.');
        }

        // 更新双图测试进度
        function updateDualTestProgress() {
            // document.getElementById('dual-test-progress').textContent = 
            //     `Progress: ${currentTestIndex + 1}/${testData[`${currentTestType}_dual`].length} <br> Please carefully review and select the image that you believe is REAL.`;
            const el = document.getElementById('dual-test-progress');
            

            // testData[`${currentTestType}_dual`][currentTestIndex];
            // if(testData[`${currentTestType}_dual`][currentTestIndex][0].includes("attention"))
            // {
            //     el.innerHTML = `Please carefully review and select the image that you believe is REAL.`;
            // }
            // else{
            //     el.innerHTML = `Question: ${currentTestIndex + 1}/${testData[`${currentTestType}_dual`].length}<br>
            // Please carefully review and select the image that you believe is REAL.`;
            // }

            if(currentTestType=='pre')
            {
                // if(currentTestIndex==pretech_dual)
                // {
                //     el.innerHTML = `Please carefully review and select the image that you believe is REAL.`;
                // }
                // else
                // {
                    el.innerHTML = `Question: ${currentTestIndex + 1}/21<br>
                    Please carefully review and select the image that you believe is REAL.`;
                // }
            }
            else
            {
                // if(currentTestIndex==formaltech_dual)
                // {
                //     el.innerHTML = `Please carefully review and select the image that you believe is REAL.`;
                // }
                // else
                // {
                    el.innerHTML = `Question: ${currentTestIndex + 1}/21<br>
                    Please carefully review and select the image that you believe is REAL.`;
                // }
            }
        }

        // function extractFileName(path) {
        //     // 将路径按斜杠分割成数组
        //     const parts = path.split('/');
        //     // 获取最后一部分（完整文件名）
        //     const fullFileName = parts[parts.length - 1];
        //     // 将文件名按点分割，取第一部分（不含扩展名）
        //     const fileNameWithoutExt = fullFileName.split('.')[0];
        //     return fileNameWithoutExt;
        // }
        function extractFileName(path) {
            // 将路径按斜杠分割成数组
            const parts = path.split('/');
            // 获取最后一部分（完整文件名）
            const fullFileName = parts[parts.length - 1];
            // 找到最后一个点的位置
            const dotIndex = fullFileName.lastIndexOf('.');
            // 如果文件名包含点（即有扩展名），取点前的部分，否则返回完整文件名
            const fileNameWithoutExt = dotIndex === -1 ? fullFileName : fullFileName.slice(0, dotIndex);
            return fileNameWithoutExt;
        }


        // 提交测试结果到服务器
        async function submitTestResults(diff) {
            // showLoading();
            
            try {
                s1=[]
                s2=[]
                
                if(diff==="pre"){
                    s1=testResults.pre_single
                    s2=testResults.pre_dual
                }
                else if(diff==="formal"){
                    s1=testResults.formal_single
                    s2=testResults.formal_dual
                }
                else if(diff==="train"){
                    s1=testResults.train_single
                }

                for (let i = 0; i < s1.length; i++){
                    s1[i].image=extractFileName(s1[i].image)
                }
                for (let i = 0; i < s2.length; i++){
                    s2[i].images[0]=extractFileName(s2[i].images[0])
                    s2[i].images[1]=extractFileName(s2[i].images[1])
                }
                //console.log(s1,s2)


                const response = await fetch('/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: userId,
                        group:testData.group,
                        policy:trainPolicySingleFirst,
                        stage:currentTestType,
                        single: s1,
                        dual:s2,
                        attention:testResults.attention,
                        timestamp: buildTimestampPayload(),
                    })
                });
                
                if (!response.ok) throw new Error('Failed to submit results');
            } catch (error) {
                alert('Error submitting results: ' + error.message);
            } finally {
                // hideLoading();
            }
        }

        async function submitTestResults2() {
            // showLoading();
            
            try {
                const response = await fetch('/submitscore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: userId,
                        score1:testResults.pre_single_score,
                        score2:null,
                        score3:testResults.formal_single_score,
                        score4:null,
                    })
                });
                
                if (!response.ok) throw new Error('Failed to submit results');
            } catch (error) {
                alert('Error submitting results: ' + error.message);
            } finally {
                // hideLoading();
            }
        }
        
        function releaseTrain(){
            if (trainover===false){
                document.getElementById('train-button').disabled = false;
                trainover=true;
            }
        }


        // 图片放大功能
        function zoomImage(imageId) {
            interactionLog.zoomOpenedAt = Date.now();
            appendTimeline('zoom_open', { x: interactionLog.lastMouse.x, y: interactionLog.lastMouse.y, page: getActivePageId() });
            startTimer("zoom");
            const image = document.getElementById(imageId);
            const zoomImg = document.getElementById('zoom-img');
            zoomImg.src = image.src;

            // 确保以图片中心缩放
            zoomImg.style.transformOrigin = '50% 50%';

            // 重置缩放和位置
            resetZoom();

            document.getElementById('zoom-modal').style.display = 'flex';
        }

        // 关闭放大模态框
        function closeZoom() {
            time = stopTimer("zoom");
            zoomTimerAll+=time;
            appendTimeline('zoom_close', { x: interactionLog.lastMouse.x, y: interactionLog.lastMouse.y, page: getActivePageId(), zoom_duration_ms: Math.round((time || 0) * 1000), zoomtime: roundNumber(zoomTimerAll, 3) });
            interactionLog.zoomOpenedAt = null;
            // console.log("this time zoom in time is :",zoomTimerAll);
            document.getElementById('zoom-modal').style.display = 'none';   
        }

        // 重置缩放
        function resetZoom() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateZoomTransform();
        }

        // 开始拖动
        function startDrag(e) {
        // 只有按下左键并且目标是图片时允许拖动
            if (e.target.id === 'zoom-img' && e.button === 0) {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                interactionLog.currentDrag = { x: e.clientX, y: e.clientY, ts: Date.now(), perf: performance.now() };
                appendTimeline('drag_start', { x: e.clientX, y: e.clientY, page: getActivePageId(), zoom: true });
                e.preventDefault();
            }
        }

        // 拖动中
        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();

            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;

            translateX += deltaX;
            translateY += deltaY;

            lastX = e.clientX;
            lastY = e.clientY;

            updateZoomTransform();
            }

            // 结束拖动
            function endDrag() {
                if (isDragging && interactionLog.currentDrag) {
                    const d = interactionLog.currentDrag;
                    const dx = lastX - d.x;
                    const dy = lastY - d.y;
                    appendTimeline('drag_end', {
                        start_x: d.x,
                        start_y: d.y,
                        end_x: lastX,
                        end_y: lastY,
                        dx: Math.round(dx),
                        dy: Math.round(dy),
                        direction: dragDirection(dx, dy),
                        duration_ms: Math.round(performance.now() - d.perf),
                        page: getActivePageId(),
                        zoom: true
                    });
                }
                interactionLog.currentDrag = null;
                isDragging = false;
            }

            // 处理缩放 —— 固定以图片中心缩放
            function handleZoom(e) {
            e.preventDefault();

            const ZOOM_STEP = 0.10;     // 每次滚轮的缩放步进
            const MIN_SCALE = 0.1;      // 最小缩放
            const MAX_SCALE = 8;        // 最大缩放（可按需调整）

            // 只更新 scale，不改 translateX/translateY
            const factor = e.deltaY < 0 ? (1 + ZOOM_STEP) : (1 / (1 + ZOOM_STEP));
            scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
            appendTimeline('wheel', { x: e.clientX, y: e.clientY, direction: wheelDirection(e.deltaY), delta_y: Math.round(e.deltaY), delta_x: Math.round(e.deltaX || 0), page: getActivePageId(), zoom: true, scale: roundNumber(scale, 3) });

            updateZoomTransform();
        }

        // 只保留一个：更新缩放与位置
        function updateZoomTransform() {
            const zoomImg = document.getElementById('zoom-img');
            zoomImg.style.transform =
                `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }


        // 页面导航
        // function goToPage(pageId) {
        //     // 隐藏所有页面
        //     document.querySelectorAll('.page').forEach(page => {
        //         page.style.display = 'none';
        //     });
            
        //     // 显示目标页面
        //     document.getElementById(pageId).style.display = 'flex';
        // }
        function goToPage(pageId) {
            // 1) 取消所有页面的 active，并隐藏
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
                page.setAttribute('aria-hidden', 'true');
            });

            // 2) 激活目标页面
            const target = document.getElementById(pageId);
            if (target) {
                target.classList.add('active');
                target.setAttribute('aria-hidden', 'false');
            }

            // 3) 重置滚动位置（如果你希望每次切页回到顶部）
            const scroller = document.querySelector('.page-content');
            if (scroller) scroller.scrollTop = 0;
            if (typeof appendTimeline === 'function') appendTimeline('page_view', { to: pageId });
        }

        // 显示加载状态
        function showLoading() {
            document.getElementById('loading').style.display = 'flex';
        }

        // 隐藏加载状态
        function hideLoading() {
            document.getElementById('loading').style.display = 'none';
        }