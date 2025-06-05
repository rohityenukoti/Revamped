import wixData from 'wix-data';
import { currentMember } from 'wix-members';
import { orders } from 'wix-pricing-plans.v2';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from "wix-window-frontend";
import wixStorage from 'wix-storage';
import { getAzureConfig } from "backend/secrets.web";
import { saveChatHistoryToMediaManager } from "backend/chatHistory.web";

const $combinedWidget = $w('#combinedHTML');

let selections = { topic: null, category: null, subCategory: null, caseName: null };
let userResponses = {};
let userResponsesData = null;
let azureConfig = null;

// Add a global variable to cache the fetched tree structure
let cachedTreeStructure = null;

$w.onReady(async function () {
    // Show the widget immediately to improve perceived performance
    $combinedWidget.show();

    // Run non-critical operations in parallel
    const initPromises = [
        initializeAzureConfig(),
        loadUserResponses(),
        loadTreeViewData()
    ];

    // Setup event listeners and URL handling immediately
    $combinedWidget.onMessage((event) => {
        const { type } = event.data;
        
        switch (type) {
            case 'saveChatHistory':
                saveChatHistory(event.data.chatHistory);
                break;
            case 'evaluationResult':
                saveEvaluationResult(event.data.result);
                break;
            case 'timestampChanged':
                const caseName = selections.caseName;
                if (caseName) {
                    loadAnswers(caseName, parseInt(event.data.index));
                }
                break;
            case 'sessionFeedback':
                saveSessionFeedback(event.data.feedback);
                break;
            case 'caseSelected':
                handleCaseSelection(event.data.caseName);
                break;
            case 'topicSelected':
                handleCaseSelection(event.data.topicId);
                break;
            case 'dashboardClicked':
                wixLocationFrontend.to('https://www.turingmedschool.com/dashboard');
                break;
        }
    });
    handleUrlParameters();
    testLocalStorage();

    try {
        // Wait for critical operations to complete
        await Promise.all(initPromises);

        // Handle case-specific loading if needed
        if (selections.caseName) {
            // Check access before loading case data during initialization
            const hasAccess = await checkCaseAccessAndRedirect(selections.caseName);
            if (hasAccess) {
                loadCaseData(selections.caseName);
                // Run these in parallel since they're independent
                Promise.all([
                    fetchChecklistForCurrentCase(),
                    loadTimestamps(selections.caseName)
                ]);
            }
        } else {
            showCaseSelectionLightbox();
        }
    } catch (error) {
        console.error("Error during initialization:", error);
    }

    // Setup location change handler
    wixLocationFrontend.onChange((location) => {
        handleUrlParameters();
    });
});

// Separate Azure config initialization
async function initializeAzureConfig() {
    try {
        azureConfig = await getAzureConfig();
        if (!azureConfig.hasValidKeys) {
            console.error("Azure configuration is incomplete");
            return;
        }
        const member = await currentMember.getMember();
        if (member) {
            $combinedWidget.postMessage({ 
                type: 'setAzureConfig', 
                config: azureConfig 
            });
        }
    } catch (error) {
        console.error("Failed to load Azure configuration:", error);
    }
}

async function findCasePath(caseName) {
    // First check if the case is a free case
    const freeCasesStructure = await fetchFreeCasesStructure();
    for (const [topic, topicData] of Object.entries(freeCasesStructure)) {
        if (Array.isArray(topicData)) {
            // Check if any case in the array matches
            const caseItem = topicData.find(item => item.caseName === caseName);
            if (caseItem) {
                return ['FreeCases', `FreeCases_${topic}`, `FreeCases_${topic}`, caseName];
            }
        } else {
            for (const [category, categoryData] of Object.entries(topicData)) {
                if (Array.isArray(categoryData)) {
                    // Check if any case in the array matches
                    const caseItem = categoryData.find(item => item.caseName === caseName);
                    if (caseItem) {
                        return ['FreeCases', `FreeCases_${topic}`, `FreeCases_${topic}:${category}`, caseName];
                    }
                } else {
                    for (const [subCategory, cases] of Object.entries(categoryData)) {
                        // Check if any case in the array matches
                        const caseItem = cases.find(item => item.caseName === caseName);
                        if (caseItem) {
                            return ['FreeCases', `FreeCases_${topic}`, `FreeCases_${topic}:${category}:${subCategory}`, caseName];
                        }
                    }
                }
            }
        }
    }
    
    // If not found in free cases, check regular tree structure
    const treeStructure = await fetchTreeStructure();
    for (const [topic, topicData] of Object.entries(treeStructure)) {
        if (Array.isArray(topicData)) {
            // Check if any case in the array matches
            const caseItem = topicData.find(item => item.caseName === caseName);
            if (caseItem) {
                return [topic, topic, topic, caseName];
            }
        } else {
            for (const [category, categoryData] of Object.entries(topicData)) {
                if (Array.isArray(categoryData)) {
                    // Check if any case in the array matches
                    const caseItem = categoryData.find(item => item.caseName === caseName);
                    if (caseItem) {
                        return [topic, category, category, caseName];
                    }
                } else {
                    for (const [subCategory, cases] of Object.entries(categoryData)) {
                        // Check if any case in the array matches
                        const caseItem = cases.find(item => item.caseName === caseName);
                        if (caseItem) {
                            return [topic, category, subCategory, caseName];
                        }
                    }
                }
            }
        }
    }
    return null;
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
                            userResponses = results.items[0];
                            userResponsesData = userResponses.responses; // Add this line
                        } else {
                            userResponses = {
                                userID: member.loginEmail,
                                responses: {},
                                lastUpdated: new Date()
                            };
                            userResponsesData = {}; // Add this line
                        }
                        return loadTreeViewData(); // Reload tree view after loading user responses
                    });
            } else {
                throw new Error("User not logged in");
            }
        })
        .catch((error) => {
            console.error("Error loading user responses:", error);
            userResponses = { responses: {} };
            userResponsesData = {}; // Add this line
            return loadTreeViewData(); // Reload tree view even if there's an error
        });
}

function showCaseSelectionLightbox() {
    // Instead of opening a Wix lightbox we send a command to open the modal inside our combined HTML
    $combinedWidget.postMessage({ type: 'openCaseSelection' });
}

async function fetchFreeCasesStructure() {
    try {
        const results = await wixData.query("BrainBank")
            .eq("FreeCase", true)
            .limit(1000)
            .find();

        const freeCasesStructure = {};
        results.items.forEach(item => {
            const { topic, category, subCategory, caseName, caseUID, synonyms } = item;

            if (isRedundantStructure(topic, category, subCategory)) {
                if (!freeCasesStructure[topic]) {
                    freeCasesStructure[topic] = [];
                }
                freeCasesStructure[topic].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
            } else if (category === subCategory) {
                if (!freeCasesStructure[topic]) {
                    freeCasesStructure[topic] = {};
                }
                if (!freeCasesStructure[topic][category]) {
                    freeCasesStructure[topic][category] = [];
                }
                freeCasesStructure[topic][category].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
            } else {
                if (!freeCasesStructure[topic]) {
                    freeCasesStructure[topic] = {};
                }
                if (!freeCasesStructure[topic][category]) {
                    freeCasesStructure[topic][category] = {};
                }
                if (!freeCasesStructure[topic][category][subCategory]) {
                    freeCasesStructure[topic][category][subCategory] = [];
                }
                freeCasesStructure[topic][category][subCategory].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
            }
        });

        return freeCasesStructure;
    } catch (error) {
        console.error("Error fetching free cases structure:", error);
        return {};
    }
}

async function loadTreeViewData() {
    try {
        const userPlan = await getCurrentUserPlan();
        const allowedTopics = getAllowedTopics(userPlan);
        const treeStructure = await fetchTreeStructure();
        const freeCasesStructure = await fetchFreeCasesStructure();
        
        // Cache the full tree structure for instant navigation later
        cachedTreeStructure = treeStructure;
        
        // Build the tree data starting with free cases if any exist
        const fullTreeData = [];
        
        // Add Free Cases section at the top if there are any free cases
        if (Object.keys(freeCasesStructure).length > 0) {
            const freeCasesChildren = Object.keys(freeCasesStructure).map(topic => ({
                id: `FreeCases_${topic}`,
                name: camelCaseToSentence(topic),
                type: 'topic',
                children: transformTopicDataForTreeView(topic, freeCasesStructure[topic]),
                locked: false // Free cases are never locked
            }));

            fullTreeData.push({
                id: 'FreeCases',
                name: '🆓 Free Cases',
                type: 'freeSection',
                children: freeCasesChildren,
                locked: false
            });
        }
        
        // Add regular topics
        const regularTopics = Object.keys(treeStructure).map(topic => ({
            id: topic,
            name: camelCaseToSentence(topic),
            type: 'topic',
            children: transformTopicDataForTreeView(topic, treeStructure[topic]),
            locked: !allowedTopics.includes(topic)
        }));
        
        fullTreeData.push(...regularTopics);
        
        $combinedWidget.postMessage({ type: 'setData', data: fullTreeData });
    } catch (err) {
        console.error("Error loading initial tree view data:", err);
    }
}

async function loadCaseData(caseName) {
    try {
        // Reset local storage for checklist
        wixStorage.local.removeItem('currentCaseChecklist');
        const userPlan = await getCurrentUserPlan();
        const allowedTopics = getAllowedTopics(userPlan);
        
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .include("topic", "candidateInfo", "findingsImage", "findingsText", "checklist", "FreeCase", "simulatorGender")
            .find();
        
        if (results.items.length > 0) {
            const caseData = results.items[0];
            // Check if user has topic access OR if it's a free case
            const hasTopicAccess = allowedTopics.includes(caseData.topic);
            const isFreeCase = caseData.FreeCase || false;
            
            if (hasTopicAccess || isFreeCase) {
                // Convert Wix media URL to regular HTTPS URL if it exists
                if (caseData.findingsImage) {
                    // First replace the wix:image prefix
                    let imageUrl = caseData.findingsImage.replace(
                        /^wix:image:\/\/v1\//,
                        'https://static.wixstatic.com/media/'
                    );
                    
                    // Then remove everything after the file extension
                    imageUrl = imageUrl.replace(/(.+?\.(?:png|jpg|jpeg|gif|webp))(\/.*)?$/i, '$1');
                    
                    caseData.findingsImage = imageUrl;
                }

                // Send the updated case data to the HTML component
                $combinedWidget.postMessage({ type: 'updateCaseInformation', caseData });
                
                // Send simulator gender information to set the appropriate videos
                const simulatorGender = caseData.simulatorGender || 'Female'; // Default to Female if not specified
                $combinedWidget.postMessage({ 
                    type: 'setSimulatorGender', 
                    gender: simulatorGender 
                });
                
                updateUrl(caseName);

                // Add this section to explicitly send patient info
                const patientInfo = caseData.patientInfo || '';
                $combinedWidget.postMessage({ 
                    type: 'updatePatientInfo', 
                    patientInfo 
                });

                if (caseData.checklist && caseData.checklist.Checklist) {
                    wixStorage.local.setItem('currentCaseChecklist', JSON.stringify(caseData.checklist.Checklist));
                    setTimeout(() => {
                        loadTimestamps(caseName);
                    }, 100);
                } else {
                    console.error("Checklist data is missing or invalid");
                }
                const casePath = await findCasePath(caseName);
                if (casePath) {
                    $combinedWidget.postMessage({ 
                        type: 'highlightCase', 
                        topic: casePath[0],
                        category: casePath[1],
                        subCategory: casePath[2],
                        caseName: casePath[3]
                    });
                }
            } else {
                console.error("User does not have access to this case:", caseName);
                
                // Show user-friendly message before redirect
                $combinedWidget.postMessage({ 
                    type: 'showAccessDeniedMessage', 
                    caseName: caseName,
                    message: `You don't have access to this case. Redirecting to pricing plans...`
                });
                
                // Add a small delay to let user see the message before redirecting
                setTimeout(() => {
                    wixLocationFrontend.to('/plans-pricing');
                }, 2000); // 2 second delay
                
                return;
            }
        } else {
            console.error("Case not found:", caseName);
        }
    } catch (error) {
        console.error("Error loading case data:", error);
    }
}

function updateUrl(caseName) {
    wixLocationFrontend.queryParams.add({ "case": caseName });
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
            const { topic, category, subCategory, caseName, caseUID, synonyms } = item;

            if (isRedundantStructure(topic, category, subCategory)) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = [];
                }
                treeStructure[topic].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
            } else if (category === subCategory) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = {};
                }
                if (!treeStructure[topic][category]) {
                    treeStructure[topic][category] = [];
                }
                treeStructure[topic][category].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
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
                treeStructure[topic][category][subCategory].push({ 
                    caseName, 
                    caseUID, 
                    synonyms: synonyms || [] 
                });
            }
        });

        return treeStructure;
    } catch (error) {
        console.error("Error fetching tree structure:", error);
        return {};
    }
}

async function getCurrentUserPlan() {
    const maxRetries = 5; // Increased retries
    const baseDelay = 1000; // 1 second base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            //console.log(`Getting user plans (attempt ${attempt}/${maxRetries})`);
            
            const member = await currentMember.getMember();
            if (member) {
                const ordersList = await orders.memberListOrders();
                
                // Add null check to prevent undefined error
                if (ordersList && ordersList.orders && Array.isArray(ordersList.orders)) {
                    const activeOrders = ordersList.orders.filter(order => order.status === "ACTIVE");
                    
                    if (activeOrders.length > 0) {
                        // Return all active plan names
                        const userPlans = activeOrders.map(order => order.planName);
                        //console.log("Successfully retrieved user plans:", userPlans);
                        return userPlans;
                    } else {
                        // User has no active orders - this is valid
                        //console.log("User has no active orders, defaulting to Free plan");
                        return ["Free"];
                    }
                } else {
                    throw new Error("Invalid ordersList response - retrying...");
                }
            } else {
                // No member found - this could be a guest user
                //console.log("No member found, defaulting to Free plan");
                return ["Free"];
            }
        } catch (error) {
            console.error(`Error getting user plans (attempt ${attempt}/${maxRetries}):`, error);
            
            // If this is the last attempt, try one more time after a longer delay
            if (attempt === maxRetries) {
                //console.log("Final retry attempt after extended delay...");
                await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
                
                // One final attempt
                try {
                    const member = await currentMember.getMember();
                    if (member) {
                        const ordersList = await orders.memberListOrders();
                        if (ordersList && ordersList.orders && Array.isArray(ordersList.orders)) {
                            const activeOrders = ordersList.orders.filter(order => order.status === "ACTIVE");
                            if (activeOrders.length > 0) {
                                return activeOrders.map(order => order.planName);
                            }
                        }
                    }
                    return ["Free"];
                } catch (finalError) {
                    console.error("Final attempt failed:", finalError);
                    return ["Free"];
                }
            }
            
            // Wait before retrying with exponential backoff
            const delay = baseDelay * Math.pow(2, attempt - 1);
            //console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
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
        "Free": [], // Remove hardcoded Breaking Bad News - free cases will be controlled by FreeCase boolean
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

async function handleCaseSelection(selectedId) {
    try {
        if (selectedId.includes('caseName:')) {
            const caseName = selectedId.split(':')[1];
            selections.caseName = caseName;
            
            // Check access before setting loading state
            const hasAccess = await checkCaseAccessAndRedirect(caseName);
            if (!hasAccess) {
                return; // Access check will handle the redirect
            }
            
            // Set loading state
            $combinedWidget.postMessage({ 
                type: 'setLoading', 
                caseId: selectedId, 
                isLoading: true 
            });

            try {
                // Load case data first
                await loadCaseData(caseName);
                
                // Then explicitly fetch the checklist - make this a separate await to ensure it completes
                const checklist = await fetchChecklistForCurrentCase();
                
                if (!checklist) {
                    console.warn("No checklist found or error fetching checklist for case:", caseName);
                }
                
                // Close case selection and remove loading state
                $combinedWidget.postMessage({ type: 'closeCaseSelection' });
                $combinedWidget.postMessage({ 
                    type: 'setLoading', 
                    caseId: selectedId, 
                    isLoading: false 
                });
                
                // Update patient info
                const results = await wixData.query("BrainBank")
                    .eq("caseName", caseName)
                    .find();
                if (results.items.length > 0) {
                    const patientInfo = results.items[0].patientInfo || '';
                    $combinedWidget.postMessage({ 
                        type: 'updatePatientInfo', 
                        patientInfo 
                    });
                }
            } catch (error) {
                // Make sure to remove loading state even if there's an error
                $combinedWidget.postMessage({ 
                    type: 'setLoading', 
                    caseId: selectedId, 
                    isLoading: false 
                });
                throw error;
            }
        } else {
            // When a topic, category, or subcategory is selected,
            // no additional backend call is required since the full tree data is already loaded.
            // You can (optionally) update the UI to highlight the selected branch
            // using the cachedTreeStructure if needed.
        }
    } catch (error) {
        console.error("Error in handleCaseSelection:", error);
    }
}

// Helper function to check if user has access to a case and redirect if not
async function checkCaseAccessAndRedirect(caseName) {
    try {
        const userPlan = await getCurrentUserPlan();
        const allowedTopics = getAllowedTopics(userPlan);
        
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .include("topic")
            .include("FreeCase")
            .find();
        
        if (results.items.length > 0) {
            const caseData = results.items[0];
            // Check if user has topic access OR if it's a free case
            const hasTopicAccess = allowedTopics.includes(caseData.topic);
            const isFreeCase = caseData.FreeCase || false;
            
            if (!hasTopicAccess && !isFreeCase) {
                console.error("User does not have access to this case:", caseName);
                
                // Show user-friendly message before redirect
                $combinedWidget.postMessage({ 
                    type: 'showAccessDeniedMessage', 
                    caseName: caseName,
                    message: `You don't have access to this case. Redirecting to pricing plans...`
                });
                
                // Add a small delay to let user see the message before redirecting
                setTimeout(() => {
                    wixLocationFrontend.to('/plans-pricing');
                }, 2000); // 2 second delay
                
                return false;
            }
            return true;
        } else {
            console.error("Case not found:", caseName);
            return false;
        }
    } catch (error) {
        console.error("Error checking case access:", error);
        return false;
    }
}

function handleUrlParameters() {
    const caseName = wixLocationFrontend.query["case"];
    if (caseName) {
        selections.caseName = caseName;
        // Check access before loading case data
        checkCaseAccessAndRedirect(caseName).then((hasAccess) => {
            if (hasAccess) {
                // First load the case data which will trigger patient info update
                loadCaseData(caseName)
                    .then(() => fetchChecklistForCurrentCase());
            }
        });
    } else {
        $combinedWidget.postMessage({ 
            type: 'highlightCase', 
            topic: null,
            category: null,
            subCategory: null,
            caseName: null
        });
        selections.caseName = null;
    }
}

function transformTopicDataForTreeView(topic, topicData) {
    const transformedData = [];

    if (Array.isArray(topicData)) {
        return topicData.map(caseItem => ({
            id: `caseName:${caseItem.caseName}`,
            name: camelCaseToSentence(caseItem.caseName),
            type: 'caseName',
            hasResponse: hasCaseResponse(caseItem.caseName),
            caseUID: caseItem.caseUID,
            synonyms: caseItem.synonyms || []
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
                    caseUID: caseItem.caseUID,
                    synonyms: caseItem.synonyms || []
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
                        caseUID: caseItem.caseUID,
                        synonyms: caseItem.synonyms || []
                    }))
                };
                categoryItem.children.push(subCategoryItem);
            });

            transformedData.push(categoryItem);
        }
    });

    return transformedData;
}

function hasCaseResponse(caseName) {
    return userResponses.responses && userResponses.responses[caseName] && userResponses.responses[caseName].length > 0;
}

function loadTimestamps(caseName) {
    if (!userResponsesData || !userResponsesData[caseName]) {
        $combinedWidget.postMessage({ type: 'clearTimestamps' });
        return;
    }
    const caseResponses = userResponsesData[caseName];
    const options = caseResponses.map((response, index) => {
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
            label: `${response.AI ? '🤖' : '👤'} ${formattedDate}${scoreDisplay}`,
            value: index.toString()
        };
    });
    $combinedWidget.postMessage({ type: 'updateTimestamps', caseName, options });
    if (caseResponses.length > 0) {
        const lastIndex = (caseResponses.length - 1).toString();
        $combinedWidget.postMessage({ type: 'selectTimestamp', caseName, value: lastIndex });
        loadAnswers(caseName, caseResponses.length - 1, 0);
    } else {
        $combinedWidget.postMessage({ type: 'clearAnswers', caseName });
    }
}

async function loadAnswers(caseName, timestampIndex, retryCount = 0) {
    const storedChecklist = wixStorage.local.getItem('currentCaseChecklist');
    if (!userResponsesData || !userResponsesData[caseName] || timestampIndex === undefined) {
        // Instead of clearing Wix UI elements, we could send a message to clear answers
        $combinedWidget.postMessage({ type: 'clearAnswers', caseName });
        return;
    }
    const caseResponses = userResponsesData[caseName][timestampIndex];
    if (!storedChecklist) {
        if (retryCount < 3) {
            setTimeout(() => loadAnswers(caseName, timestampIndex, retryCount + 1), 100);
            return;
        }
        $combinedWidget.postMessage({ type: 'clearAnswers', caseName });
        return;
    }
    let caseChecklist;
    try {
        caseChecklist = JSON.parse(storedChecklist);
    } catch (error) {
        console.error("Error parsing stored checklist:", error);
        $combinedWidget.postMessage({ type: 'clearAnswers', caseName });
        return;
    }
    displayResults(caseChecklist, caseResponses);
}

function displayResults(checklist, responses) {
    const domainMapping = {
        "Data Gathering": "dataGathering",
        "Management": "management",
        "Interpersonal Skills": "interpersonalSkills"
    };
    const results = {
        dataGathering: { 
            covered: [], 
            missed: [], 
            partial: [],
            score: responses.dataGathering?.score || "0.00" 
        },
        management: { 
            covered: [], 
            missed: [], 
            partial: [],
            score: responses.management?.score || "0.00" 
        },
        interpersonalSkills: { 
            covered: [], 
            missed: [], 
            partial: [],
            score: responses.interpersonalSkills?.score || "0.00" 
        }
    };
    const domainIndices = { dataGathering: 0, management: 0, interpersonalSkills: 0 };
    checklist.forEach((item) => {
        const domainKey = domainMapping[item.Domain];
        if (!domainKey) {
            console.error(`Unknown domain: ${item.Domain}`);
            return;
        }
        const domainIndex = domainIndices[domainKey];
        const domainData = responses[domainKey];
        
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
        
        domainIndices[domainKey]++;
    });
    $combinedWidget.postMessage({ type: 'displayResults', results });
}

function testLocalStorage() {
    try {
        wixStorage.local.setItem('test', 'test');
        const testValue = wixStorage.local.getItem('test');
        wixStorage.local.removeItem('test');
    } catch (error) {
        console.error("Local storage test failed:", error);
    }
}

async function saveChatHistory(chatHistory) {
    if (!selections.caseName) {
        console.error("No case selected");
        return;
    }
    try {
        const member = await currentMember.getMember();
        if (!member) {
            console.error("User not logged in");
            return;
        }

        const result = await saveChatHistoryToMediaManager(chatHistory, selections.caseName, member.loginEmail);
        if (!result.success) {
            console.error("Failed to save chat history:", result.error);
        }
    } catch (error) {
        console.error("Error saving chat history:", error);
    }
}

async function fetchChecklistForCurrentCase() {
    if (!selections.caseName) {
        console.error("No case selected");
        return null;
    }
    try {
        const results = await wixData.query("BrainBank")
            .eq("caseName", selections.caseName)
            .find();
        if (results.items.length > 0) {
            const caseData = results.items[0];
            // Check if checklist exists and has the expected structure
            if (caseData.checklist && caseData.checklist.Checklist) {
                // Store the checklist in local storage
                wixStorage.local.setItem('currentCaseChecklist', JSON.stringify(caseData.checklist.Checklist));
                
                // Send the checklist directly to the HTML component
                $combinedWidget.postMessage({
                    type: 'setChecklist',
                    checklist: caseData.checklist.Checklist // Send the actual checklist array, not the wrapper object
                });
                
                //console.log("Checklist sent to HTML:", caseData.checklist.Checklist);
                return caseData.checklist.Checklist;
            } else {
                console.error("Checklist data is missing or invalid for case:", selections.caseName);
                //console.log("Received checklist data:", caseData.checklist);
                return null;
            }
        } else {
            console.error("Checklist not found for case:", selections.caseName);
            return null;
        }
    } catch (error) {
        console.error("Error fetching checklist:", error);
        return null;
    }
}

async function saveEvaluationResult(evaluationResult) {
    if (!selections.caseName) {
        console.error("No case selected");
        return;
    }
    try {
        const member = await currentMember.getMember();
        if (!member) {
            console.error("User not logged in");
            return;
        }
        const userEmail = member.loginEmail;
        const timestamp = new Date().toISOString();
        let parsedResult;
        try {
            parsedResult = JSON.parse(evaluationResult);
        } catch (error) {
            console.error("Error parsing evaluation result:", error);
            return;
        }
        if (!parsedResult || !parsedResult.Checklist || !Array.isArray(parsedResult.Checklist)) {
            console.error("Invalid evaluation result structure");
            return;
        }
        const checklist = parsedResult.Checklist;
        const domainData = {
            datagathering: { scoreArray: [], score: 0 },
            management: { scoreArray: [], score: 0 },
            interpersonalskills: { scoreArray: [], score: 0 }
        };
        checklist.forEach(item => {
            if (item && item.Domain) {
                const domainKey = item.Domain.toLowerCase().replace(/\s+/g, '');
                if (domainData[domainKey]) {
                    // Convert status to score: covered = 1, partial = 0.5, missed = 0
                    let score = 0;
                    if (item.Status === 'covered') {
                        score = 1;
                    } else if (item.Status === 'partial') {
                        score = 0.5;
                    } else if (item.Status === 'missed') {
                        score = 0;
                    }
                    domainData[domainKey].scoreArray.push(score);
                }
            }
        });
        Object.keys(domainData).forEach(domain => {
            const scoreArray = domainData[domain].scoreArray;
            if (scoreArray.length > 0) {
                const totalScore = scoreArray.reduce((sum, score) => sum + score, 0);
                domainData[domain].score = ((totalScore / scoreArray.length) * 4).toFixed(2);
            }
        });
        let userResponsesRecord = await wixData.query("userResponses")
            .eq("userID", userEmail)
            .find();
        let record;
        if (userResponsesRecord.items.length > 0) {
            record = userResponsesRecord.items[0];
            if (!record.responses) { record.responses = {}; }
        } else {
            record = { userID: userEmail, responses: {} };
        }
        if (!record.responses[selections.caseName]) {
            record.responses[selections.caseName] = [];
        }
        const newEvaluation = {
            timestamp: timestamp,
            dataGathering: domainData.datagathering,
            management: domainData.management,
            interpersonalSkills: domainData.interpersonalskills,
            AI: true
        };
        record.responses[selections.caseName].push(newEvaluation);
        if (userResponsesRecord.items.length > 0) {
            await wixData.update("userResponses", record);
        } else {
            await wixData.insert("userResponses", record);
        }

        // After saving, immediately load the new timestamps and display results
        await loadUserResponses(); // Refresh the user responses data
        loadTimestamps(selections.caseName); // This will trigger loading the latest evaluation
        
        // Show the performance lightbox
        $combinedWidget.postMessage({ 
            type: 'showPerformance',
            autoSelectLatest: true // New flag to indicate we want the latest timestamp
        });

    } catch (error) {
        console.error("Error saving evaluation result:", error);
    }
}

async function saveSessionFeedback(feedback) {
    if (!selections.caseName) {
        console.error("No case selected");
        return;
    }
    try {
        const member = await currentMember.getMember();
        if (!member) {
            console.error("User not logged in");
            return;
        }
        const userEmail = member.loginEmail;
        
        // Get existing record
        let userResponsesRecord = await wixData.query("userResponses")
            .eq("userID", userEmail)
            .find();
        
        let record;
        if (userResponsesRecord.items.length > 0) {
            record = userResponsesRecord.items[0];
            if (!record.feedback) {
                record.feedback = {};
            }
        } else {
            record = { 
                userID: userEmail, 
                responses: {},
                feedback: {} 
            };
        }
        
        // Add feedback to the case
        if (!record.feedback[selections.caseName]) {
            record.feedback[selections.caseName] = [];
        }
        
        record.feedback[selections.caseName].push({
            rating: feedback.rating,
            comment: feedback.comment,
            timestamp: feedback.timestamp
        });
        
        // Save or update record
        if (userResponsesRecord.items.length > 0) {
            await wixData.update("userResponses", record);
        } else {
            await wixData.insert("userResponses", record);
        }
        
        //console.log("Session feedback saved successfully");
    } catch (error) {
        console.error("Error saving session feedback:", error);
    }
}