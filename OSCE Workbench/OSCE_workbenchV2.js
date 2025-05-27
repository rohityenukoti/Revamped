import wixData from 'wix-data';
import { currentMember } from 'wix-members';
import { orders } from 'wix-pricing-plans.v2';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from "wix-window-frontend";
import wixStorage from 'wix-storage';

// Single HTML component reference
const $workbenchComponent = $w('#workbenchHTML');

// State
let state = {
    mode: 'review',
    currentCase: null,
    userResponses: {},
    userResponsesData: null,
    currentCaseChecklist: null,
    roomCodes: {} // Store room codes by case
};

$w.onReady(function () {
    // Check URL parameters first
    const urlCase = wixLocationFrontend.query["case"];
    const urlMode = wixLocationFrontend.query["mode"];
    
    // Set the mode based on URL parameter (mode=0 for review, mode=1 for practice)
    // Default to review mode if no valid mode parameter
    if (urlMode === "1") {
        state.mode = 'practice';
    } else {
        state.mode = 'review'; // Default to review mode
    }
    
    if (!urlCase) {
        // Show case selection lightbox automatically when no case is selected
        showCaseSelectionLightbox();
    }

    // Initialize the workbench
    setupEventListeners();
    setMode(state.mode);
    
    loadUserResponses().then(() => {
        loadTreeViewData();
    });
    
    handleUrlParameters();
    wixLocationFrontend.onChange((location) => {
        handleUrlParameters();
    });
});

// Event Listeners
function setupEventListeners() {
    $workbenchComponent.onMessage((event) => {
        if (!event.data) return;
        
        switch (event.data.type) {
            case 'modeChange':
                setMode(event.data.mode);
                // Update URL when mode changes
                updateModeInUrl(event.data.mode);
                break;
            case 'generateLink':
                generateShareableLink();
                break;
            case 'getVideoCallInfo':
                provideVideoCallInfo();
                break;
            case 'caseSelected':
                handleCaseSelection(event.data.caseName);
                break;
            case 'topicSelected':
                handleTopicSelection(event.data.topicId);
                break;
            case 'timestampChange':
                handleTimestampChange(event.data.value);
                break;
            case 'sectionsWidgetReady':
                // We recognize this message but don't need to do anything special
                console.log('Sections widget is ready');
                break;
            case 'copyToClipboard':
                wixWindowFrontend.copyToClipboard(event.data.text).catch(error => {
                    console.error('Failed to copy:', error);
                    $workbenchComponent.postMessage({
                        type: 'showError',
                        message: "Failed to copy to clipboard: " + error.message
                    });
                });
                break;
            case 'navigate':
                // Handle navigation requests from the HTML component
                if (event.data.data && event.data.data.url) {
                    let url = event.data.data.url;
                    
                    // If navigating to PatientGPT and no case parameter is present, add the current case
                    if (url.startsWith('/patientgpt') && !url.includes('?case=') && state.currentCase) {
                        url += `?case=${encodeURIComponent(state.currentCase)}`;
                    }
                    
                    wixLocationFrontend.to(url);
                }
                break;
            default:
                console.log('Unknown message type:', event.data.type);
        }
    });
}

// Function to update mode in URL
function updateModeInUrl(mode) {
    const modeValue = mode === 'practice' ? "1" : "0";
    wixLocationFrontend.queryParams.add({ "mode": modeValue });
}

function setMode(mode) {
    if (!mode) {
        mode = 'review'; // Default mode if not specified
    }
    state.mode = mode;
    $workbenchComponent.postMessage({ 
        type: 'setMode', 
        data: { mode: mode }
    });
}

function handleTimestampChange(value) {
    const selectedCase = state.currentCase;
    const selectedTimestampIndex = parseInt(value);
    loadAnswers(selectedCase, selectedTimestampIndex, 0);
}

async function handleTopicSelection(topicId) {
    try {
        if (!topicId) {
            console.error("Invalid topicId:", topicId);
            return;
        }

        // Since we already have all the data, we just need to toggle the topic's open state
        $workbenchComponent.postMessage({ 
            type: 'toggleTopic', 
            topicId: topicId 
        });
    } catch (err) {
        console.error("Error handling topic selection:", err);
    }
}

function showCaseSelectionLightbox() {
    // Open the Brainbank directly instead of showing a dialogue
    $workbenchComponent.postMessage({ 
        type: 'openBrainbank' 
    });
}

async function loadTreeViewData() {
    try {
        const userPlan = await getCurrentUserPlan();
        const allowedTopics = getAllowedTopics(userPlan);
        const treeStructure = await fetchTreeStructure();
        
        // Transform the complete tree structure
        const completeTreeData = Object.entries(treeStructure).map(([topic, topicData]) => {
            const isLocked = !allowedTopics.includes(topic);
            return {
                id: topic,
                name: camelCaseToSentence(topic),
                type: 'topic',
                locked: isLocked,
                children: isLocked ? null : transformTopicDataForTreeView(topic, topicData)
            };
        });

        $workbenchComponent.postMessage({ 
            type: 'setTreeData', 
            data: completeTreeData 
        });
    } catch (err) {
        console.error("Error loading initial tree view data:", err);
    }
}

async function getCaseIndex(caseName) {
    try {
        //console.log("Fetching index for case:", caseName);
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .find();
        //console.log("Query results:", results);
        if (results.items.length > 0) {
            const index = results.items[0].index;
            //console.log("Found index:", index);
            return index;
        } else {
            console.error("Case not found:", caseName);
            return null;
        }
    } catch (error) {
        console.error("Error fetching case index:", error);
        throw error; // Propagate the error
    }
}

async function generateShareableLink() {
    const caseName = state.currentCase;
    if (!caseName) {
        $workbenchComponent.postMessage({
            type: 'showError',
            message: "Please select a case before generating a link."
        });
        return;
    }

    try {
        const caseIndex = await getCaseIndex(caseName);
        if (caseIndex === null || caseIndex === undefined) {
            $workbenchComponent.postMessage({
                type: 'showError',
                message: "Unable to generate link. Case index not found."
            });
            return;
        }

        const member = await currentMember.getMember();
        if (member) {
            const baseUrl = "https://turingmedschool.com/simulator-page";
            
            // Use existing room code or generate a new one
            if (!state.roomCodes[caseName]) {
                state.roomCodes[caseName] = generateRandomRoomCode(5);
            }
            const roomName = state.roomCodes[caseName];
            
            // Generate the link without initializing Jitsi
            const shareableLink = `${baseUrl}?index=${encodeURIComponent(caseIndex)}&email=${encodeURIComponent(member.loginEmail)}&room=${encodeURIComponent(roomName)}`;

            // Notify the HTML component that the link was generated
            $workbenchComponent.postMessage({
                type: 'simulatorLinkGenerated',
                link: shareableLink
            });
            
        } else {
            $workbenchComponent.postMessage({
                type: 'showError',
                message: "You must be logged in to generate a shareable link."
            });
        }
    } catch (error) {
        console.error("Error in generateShareableLink:", error);
        $workbenchComponent.postMessage({
            type: 'showError',
            message: "Error generating link: " + error.message
        });
    }
}

// Helper function to generate a random alphanumeric code
function generateRandomRoomCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// New function to provide video call info to HTML component
async function provideVideoCallInfo() {
    const caseName = state.currentCase;
    const caseIndex = await getCaseIndex(caseName);
    if (!caseName) {
        $workbenchComponent.postMessage({
            type: 'showError',
            message: "Please select a case before starting a video call."
        });
        return;
    }

    try {
        const member = await currentMember.getMember();
        if (member) {
            // Use existing room code or generate a new one
            if (!state.roomCodes[caseName]) {
                state.roomCodes[caseName] = generateRandomRoomCode(5);
            }
            const roomName = state.roomCodes[caseName];
            
            // Send video call info to the HTML component
            $workbenchComponent.postMessage({
                type: 'videoCallInfo',
                data: {
                    roomName: roomName,
                    displayName: member.loginEmail
                }
            });
        } else {
            $workbenchComponent.postMessage({
                type: 'showError',
                message: "You must be logged in to start a video call."
            });
        }
    } catch (error) {
        console.error("Error providing video call info:", error);
        $workbenchComponent.postMessage({
            type: 'showError',
            message: "Error starting video call: " + error.message
        });
    }
}

function isRedundantStructure(topic, category, subCategory) {
    return topic === category && category === subCategory;
}

async function fetchTreeStructure() {
    try {
        const results = await wixData.query("BrainBank")
            .limit(1000)
            .find();

        const treeStructure = {};
        results.items.forEach(item => {
            const { topic, category, subCategory, caseName, caseUID } = item;

            if (isRedundantStructure(topic, category, subCategory)) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = [];
                }
                treeStructure[topic].push({ caseName, caseUID });
            } else if (category === subCategory) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = {};
                }
                if (!treeStructure[topic][category]) {
                    treeStructure[topic][category] = [];
                }
                treeStructure[topic][category].push({ caseName, caseUID });
            } else {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = {};
                }
                if (!treeStructure[topic][category]) {
                    treeStructure[topic][category] = {};
                }
                if (!treeStructure[topic][category][subCategory]) {
                    treeStructure[topic][category][subCategory] = [];
                }
                treeStructure[topic][category][subCategory].push({ caseName, caseUID });
            }
        });

        return treeStructure;
    } catch (error) {
        console.error("Error fetching tree structure:", error);
        return {};
    }
}

function camelCaseToSentence(text) {
    // Handle empty or null input
    if (!text) return '';
    
    const result = text
        // Replace underscores with spaces
        .replace(/_/g, ' ')
        // Add space before numbers
        .replace(/(\d+)/g, ' $1 ')
        // Handle special cases like 'ENT', 'DKA', 'CO' - look for 2 or more consecutive capitals
        // This now works for both start of string and after lowercase letters
        .replace(/([a-z])?([A-Z]{2,})(?=[A-Z][a-z]|$|\d)/g, (match, before, acronym) => 
            before ? `${before} ${acronym}` : acronym)
        // Add space before other capital letters
        .replace(/([A-Z][a-z])/g, ' $1')
        // Remove extra spaces and trim
        .replace(/\s+/g, ' ')
        .trim();
    
    return result.charAt(0).toUpperCase() + result.slice(1);
}

function transformTopicDataForTreeView(topic, topicData) {
    const transformedData = [];

    if (Array.isArray(topicData)) {
        return topicData.map(caseItem => ({
            id: `caseName:${caseItem.caseName}`,
            name: camelCaseToSentence(caseItem.caseName),
            type: 'caseName',
            hasResponse: hasCaseResponse(caseItem.caseName),
            caseUID: caseItem.caseUID
        }));
    }

    Object.entries(topicData).forEach(([category, subCategories]) => {
        if (Array.isArray(subCategories)) {
            transformedData.push({
                id: `${topic}:${category}`,
                name: camelCaseToSentence(category),
                type: 'category',
                children: subCategories.map(caseItem => ({
                    id: `caseName:${caseItem.caseName}`,
                    name: camelCaseToSentence(caseItem.caseName),
                    type: 'caseName',
                    hasResponse: hasCaseResponse(caseItem.caseName),
                    caseUID: caseItem.caseUID
                }))
            });
        } else {
            const categoryItem = {
                id: `${topic}:${category}`,
                name: camelCaseToSentence(category),
                type: 'category',
                children: []
            };

            Object.entries(subCategories).forEach(([subCategory, cases]) => {
                const subCategoryItem = {
                    id: `${topic}:${category}:${subCategory}`,
                    name: camelCaseToSentence(subCategory),
                    type: 'subCategory',
                    children: cases.map(caseItem => ({
                        id: `caseName:${caseItem.caseName}`,
                        name: camelCaseToSentence(caseItem.caseName),
                        type: 'caseName',
                        hasResponse: hasCaseResponse(caseItem.caseName),
                        caseUID: caseItem.caseUID
                    }))
                };
                categoryItem.children.push(subCategoryItem);
            });

            transformedData.push(categoryItem);
        }
    });

    return transformedData;
}

async function handleCaseSelection(selectedId) {
    try {
        if (selectedId.includes('caseName:')) {
            // This is a case selection
            const caseName = selectedId.split(':')[1];
            state.currentCase = caseName;
            await loadCaseData(caseName);
            $workbenchComponent.postMessage({ 
                type: 'setMode', 
                mode: state.mode || 'review' // Default to review if mode is undefined
            });
            $workbenchComponent.postMessage({ 
                type: 'closeCaseSelection' 
            });
        } else {
            // This is a topic or category selection
            const treeStructure = await fetchTreeStructure();
            const [topicId, categoryId] = selectedId.split(':');
            const topicData = treeStructure[topicId];
            
            const userPlan = await getCurrentUserPlan();
            const allowedTopics = getAllowedTopics(userPlan);
            
            if (!allowedTopics.includes(topicId)) {
                console.log("Topic is locked:", topicId);
                return; // Exit the function if the topic is locked
            }
            
            // Rest of the function remains the same
            if (Array.isArray(topicData)) {
                // Direct cases under topic
                const transformedData = transformTopicDataForTreeView(topicId, topicData);
                $workbenchComponent.postMessage({ 
                    type: 'updateTopic', 
                    data: {
                        topic: topicId, 
                        data: transformedData
                    }
                });
            } else if (categoryId && Array.isArray(topicData[categoryId])) {
                // Direct cases under category
                const transformedData = [{
                    id: selectedId,
                    name: camelCaseToSentence(categoryId),
                    type: 'category',
                    children: transformTopicDataForTreeView(topicId, {[categoryId]: topicData[categoryId]})
                }];
                $workbenchComponent.postMessage({ 
                    type: 'updateTopic', 
                    data: {
                        topic: topicId, 
                        data: transformedData
                    }
                });
            } else if (topicData) {
                const transformedData = transformTopicDataForTreeView(topicId, topicData);
                $workbenchComponent.postMessage({ 
                    type: 'updateTopic', 
                    data: {
                        topic: topicId, 
                        data: transformedData
                    }
                });
            } else {
                console.error("Topic not found:", topicId);
            }
        }
    } catch (err) {
        console.error("Error handling selection:", err);
    }
}

function handleUrlParameters() {
    const caseName = wixLocationFrontend.query["case"];
    const urlMode = wixLocationFrontend.query["mode"];
    
    // Set the mode based on URL parameter
    if (urlMode === "1") {
        state.mode = 'practice';
    } else {
        state.mode = 'review'; // Default to review mode
    }
    
    // Apply the mode setting
    setMode(state.mode);
    
    if (caseName) {
        state.currentCase = caseName;
        loadCaseData(caseName);
    } else {
        // If no case is specified in the URL, show the case selection lightbox
        state.currentCase = null;
        showCaseSelectionLightbox();
    }
}

function loadTimestamps(caseName) {
    if (!state.userResponsesData || !state.userResponsesData[caseName]) {
        //console.log("No responses found for this case");
        $workbenchComponent.postMessage({ 
            type: 'hideTimestampSelector' 
        });
        clearParagraphs();
        return;
    }

    const caseResponses = state.userResponsesData[caseName];
    const timestampData = caseResponses.map((response, index) => {
        // Format scores for display - round to integers
        const dgScore = response.dataGathering?.score ? Math.round(parseFloat(response.dataGathering.score)) : 0;
        const mgScore = response.management?.score ? Math.round(parseFloat(response.management.score)) : 0;
        const isScore = response.interpersonalSkills?.score ? Math.round(parseFloat(response.interpersonalSkills.score)) : 0;
        
        // Calculate total score
        const totalScore = dgScore + mgScore + isScore;
        
        // Format individual domain scores - show all scores including 0
        const dg = dgScore !== undefined && dgScore !== null ? `DG: ${dgScore}` : '';
        const mg = mgScore !== undefined && mgScore !== null ? `MG: ${mgScore}` : '';
        const is = isScore !== undefined && isScore !== null ? `IS: ${isScore}` : '';
        
        // Combine scores with timestamp and total - only filter out truly empty strings
        const formattedScores = [dg, mg, is].filter(score => score !== '').join(', ');
        const scoreDisplay = formattedScores ? ` (Total: ${totalScore}, ${formattedScores})` : '';
        
        // Format date in the requested format: "04 May 2025, 4:30 AM"
        const date = new Date(response.timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12; // Convert 24h to 12h format
        
        const formattedDate = `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
        
        return {
            label: `${formattedDate}${scoreDisplay}`,
            value: index.toString()
        };
    });

    $workbenchComponent.postMessage({ 
        type: 'showTimestampSelector', 
        data: timestampData
    });
    
    if (caseResponses.length > 0) {
        $workbenchComponent.postMessage({ 
            type: 'setTimestampValue', 
            data: { value: "0" }
        });
        loadAnswers(caseName, 0, 0); // Load answers for the most recent timestamp
    } else {
        clearParagraphs();
    }
}

async function loadAnswers(caseName, timestampIndex, retryCount = 0) {
    const storedChecklist = wixStorage.local.getItem('currentCaseChecklist');

    if (!state.userResponsesData || !state.userResponsesData[caseName] || timestampIndex === undefined) {
        clearParagraphs();
        return;
    }

    const caseResponses = state.userResponsesData[caseName][timestampIndex];

    if (!storedChecklist) {
        if (retryCount < 3) {
            setTimeout(() => loadAnswers(caseName, timestampIndex, retryCount + 1), 100);
            return;
        }
        clearParagraphs();
        return;
    }

    let caseChecklist;
    try {
        caseChecklist = JSON.parse(storedChecklist);
    } catch (error) {
        console.error("Error parsing stored checklist:", error);
        clearParagraphs();
        return;
    }

    // Round all scores to integers
    const dgScore = caseResponses.dataGathering?.score ? 
        Math.round(parseFloat(caseResponses.dataGathering.score)).toString() : 'N/A';
    const mgScore = caseResponses.management?.score ? 
        Math.round(parseFloat(caseResponses.management.score)).toString() : 'N/A';
    const isScore = caseResponses.interpersonalSkills?.score ? 
        Math.round(parseFloat(caseResponses.interpersonalSkills.score)).toString() : 'N/A';

    // Extract remarks if available
    const dgRemarks = caseResponses.dataGathering?.remarks || null;
    const mgRemarks = caseResponses.management?.remarks || null;
    const isRemarks = caseResponses.interpersonalSkills?.remarks || null;

    const results = {
        dataGathering: { covered: [], missed: [], partial: [], score: dgScore, remarks: dgRemarks },
        management: { covered: [], missed: [], partial: [], score: mgScore, remarks: mgRemarks },
        interpersonalSkills: { covered: [], missed: [], partial: [], score: isScore, remarks: isRemarks }
    };

    const domainMapping = {
        "Data Gathering": "dataGathering",
        "Management": "management",
        "Interpersonal Skills": "interpersonalSkills"
    };

    // Create an index tracker for each domain
    const domainIndices = {
        dataGathering: 0,
        management: 0,
        interpersonalSkills: 0
    };

    caseChecklist.forEach((item) => {
        const domainKey = domainMapping[item.Domain];
        if (!domainKey) return;

        const domainIndex = domainIndices[domainKey];
        const domainData = caseResponses[domainKey];
        
        if (!domainData) {
            results[domainKey].missed.push(item.Point);
            domainIndices[domainKey]++;
            return;
        }

        // Check if we have scoreArray (new format) or booleanArray (old format)
        if (domainData.scoreArray && Array.isArray(domainData.scoreArray)) {
            // New scoreArray format: 0 = missed, 0.5 = partial, 1 = covered
            const score = domainData.scoreArray[domainIndex];
            
            if (score === 1) {
                results[domainKey].covered.push(item.Point);
            } else if (score === 0.5) {
                results[domainKey].partial.push(item.Point);
            } else {
                results[domainKey].missed.push(item.Point);
            }
        } else if (domainData.booleanArray && Array.isArray(domainData.booleanArray)) {
            // Old booleanArray format: true = covered, false = missed
            const isChecked = domainData.booleanArray[domainIndex];
            
            if (isChecked) {
                results[domainKey].covered.push(item.Point);
            } else {
                results[domainKey].missed.push(item.Point);
            }
        } else {
            // No data available, mark as missed
            results[domainKey].missed.push(item.Point);
        }

        // Increment the index for this domain
        domainIndices[domainKey]++;
    });

    $workbenchComponent.postMessage({ 
        type: 'updateResults', 
        data: results 
    });
}

function testLocalStorage() {
    try {
        wixStorage.local.setItem('test', 'test');
        const testValue = wixStorage.local.getItem('test');
        wixStorage.local.removeItem('test');
        //console.log("Local storage test result:", testValue === 'test' ? "Passed" : "Failed");
    } catch (error) {
        console.error("Local storage test failed:", error);
    }
}

function clearParagraphs() {
    $workbenchComponent.postMessage({ 
        type: 'clearResults' 
    });
}

async function getCurrentUserPlan() {
    try {
        const member = await currentMember.getMember();
        if (member) {
            const ordersList = await orders.memberListOrders();
            const activeOrders = ordersList.orders.filter(order => order.status === "ACTIVE");
            
            if (activeOrders.length > 0) {                
                return activeOrders.map(order => order.planName);
            }
        }
        return "Free";
    } catch (error) {
        console.error("Error getting current user plan:", error);
        return "Free";
    }
}

function getAllowedTopics(plans) {
    const planTopics = {
        "Beta": ["BreakingBadNews", "AngryPatient", "Psychiatry_SymptomaticDifferentials",
            "Dermatology_SymptomaticDifferentials","Medicine_SymptomaticDifferentials","EyeENT_SymptomaticDifferentials",
            "MedicalEthics","Paediatrics_SymptomaticDifferentials","Counseling","OBGYN_SymptomaticDifferentials", "Teaching"],
        "Complete BrainBank Trial": ["BreakingBadNews", "AngryPatient", "Psychiatry_SymptomaticDifferentials",
            "Dermatology_SymptomaticDifferentials","Medicine_SymptomaticDifferentials","EyeENT_SymptomaticDifferentials",
            "MedicalEthics","Paediatrics_SymptomaticDifferentials","Counseling","OBGYN_SymptomaticDifferentials", "Teaching"],
        "Complete BrainBank": ["BreakingBadNews", "AngryPatient", "Psychiatry_SymptomaticDifferentials",
            "Dermatology_SymptomaticDifferentials","Medicine_SymptomaticDifferentials","EyeENT_SymptomaticDifferentials",
            "MedicalEthics","Paediatrics_SymptomaticDifferentials","Counseling","OBGYN_SymptomaticDifferentials", "Teaching"],
        "Complete BrainBank x 2 months": ["BreakingBadNews", "AngryPatient", "Psychiatry_SymptomaticDifferentials",
            "Dermatology_SymptomaticDifferentials","Medicine_SymptomaticDifferentials","EyeENT_SymptomaticDifferentials",
            "MedicalEthics","Paediatrics_SymptomaticDifferentials","Counseling","OBGYN_SymptomaticDifferentials", "Teaching"],
        "Complete BrainBank x 4 months": ["BreakingBadNews", "AngryPatient", "Psychiatry_SymptomaticDifferentials",
            "Dermatology_SymptomaticDifferentials","Medicine_SymptomaticDifferentials","EyeENT_SymptomaticDifferentials",
            "MedicalEthics","Paediatrics_SymptomaticDifferentials","Counseling","OBGYN_SymptomaticDifferentials", "Teaching"],
        "Free": ["BreakingBadNews"],
        "Breaking Bad News": ["BreakingBadNews"],
        "Angry Patient": ["AngryPatient"],
        "Paediatrics Symptomatic Differentials": ["Paediatrics_SymptomaticDifferentials"],
        "Medicine Symptomatic Differentials": ["Medicine_SymptomaticDifferentials"],
        "Dermatology Symptomatic Differentials": ["Dermatology_SymptomaticDifferentials"],
        "Psychiatry Symptomatic Differentials": ["Psychiatry_SymptomaticDifferentials"],
        "OBGYN Symptomatic Differentials": ["OBGYN_SymptomaticDifferentials"],
        "Teaching": ["Teaching"],
        "Counseling": ["Counseling"],
        "Medical Ethics": ["MedicalEthics"],
        "Eye ENT Symptomatic Differentials": ["EyeENT_SymptomaticDifferentials"],
    };

    // If plans is not an array, convert it to one
    const planArray = Array.isArray(plans) ? plans : [plans];
    
    // Filter out any plans that don't exist in planTopics and default to "Free" if none are valid
    const validPlans = planArray.filter(plan => planTopics[plan]);
    const plansToUse = validPlans.length > 0 ? validPlans : ["Free"];
    
    // Combine topics from all active plans
    const allowedTopics = new Set(plansToUse.flatMap(plan => planTopics[plan]));
    
    return Array.from(allowedTopics);
}

function loadUserResponses() {
    return currentMember.getMember()
        .then((member) => {
            if (member) {
                return wixData.query("userResponses")
                    .eq('userID', member.loginEmail)
                    .find()
                    .then((results) => {
                        if (results.items.length > 0) {
                            state.userResponses = results.items[0];
                            state.userResponsesData = results.items[0].responses; // Add this line
                        } else {
                            state.userResponses = {
                                userID: member.loginEmail,
                                responses: {},
                                lastUpdated: new Date()
                            };
                            state.userResponsesData = {}; // Add this line
                        }
                        return loadTreeViewData(); // Reload tree view after loading user responses
                    });
            } else {
                throw new Error("User not logged in");
            }
        })
        .catch((error) => {
            console.error("Error loading user responses:", error);
            state.userResponses = { responses: {} };
            state.userResponsesData = {}; // Add this line
            return loadTreeViewData(); // Reload tree view even if there's an error
        });
}

function hasCaseResponse(caseName) {
    return state.userResponses.responses && state.userResponses.responses[caseName] && state.userResponses.responses[caseName].length > 0;
}

async function loadCaseData(caseName) {
    try {
        wixStorage.local.removeItem('currentCaseChecklist');
        const userPlan = await getCurrentUserPlan();
        const allowedTopics = getAllowedTopics(userPlan);
        
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .include("topic", "candidateInfo", "checklist", "inTimeSections", "findingsImage", "findingsText", "patientInfo", "keyPoints")
            .find();
        
        if (results.items.length > 0) {
            const caseData = results.items[0];
            if (allowedTopics.includes(caseData.topic)) {
                // Convert Wix media URL to regular HTTPS URL if it exists
                let findingsImageUrl = caseData.findingsImage;
                if (findingsImageUrl) {
                    // Using the same approach as in caseEditorHTML.html
                    findingsImageUrl = findingsImageUrl
                        .replace('wix:image://v1/', 'https://static.wixstatic.com/media/')
                        .split('#')[0]  // Remove everything after #
                        .split('/').slice(0, -1).join('/'); // Remove the last path segment
                }

                // Send all case data to the HTML component
                $workbenchComponent.postMessage({
                    type: 'updateCaseData',
                    data: {
                        candidateInfo: caseData.candidateInfo?.candidateInfo?.[0] || {},
                        findingsImage: findingsImageUrl,
                        findingsText: caseData.findingsText,
                        patientInfo: caseData.patientInfo,
                        keyPoints: caseData.keyPoints,
                        inTimeSections: caseData.inTimeSections?.Consultation || [],
                        checklist: caseData.checklist?.Checklist || [],
                        caseId: `caseName:${caseName}` // Add case ID in the correct format for tree view highlighting
                    }
                });

                updateUrl(caseName);

                // Store checklist in local storage
                if (caseData.checklist?.Checklist) {
                    wixStorage.local.setItem('currentCaseChecklist', JSON.stringify(caseData.checklist.Checklist));
                    setTimeout(() => {
                        loadTimestamps(caseName);
                    }, 100);
                }
            } else {
                showError("You don't have access to this case. Please upgrade your plan.");
            }
        }
    } catch (error) {
        console.error("Error loading case data:", error);
        showError("Error loading case data: " + error.message);
        // Send error message to close loading state
        $workbenchComponent.postMessage({
            type: 'updateCaseData',
            data: null
        });
    }
}

function showError(message) {
    $workbenchComponent.postMessage({
        type: 'showError',
        message: message
    });
}

function updateUrl(caseName) {
    // Include both case and mode in the URL
    const modeValue = state.mode === 'practice' ? "1" : "0";
    wixLocationFrontend.queryParams.add({ 
        "case": caseName,
        "mode": modeValue
    });
}