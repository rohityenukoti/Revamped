import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

// HTML component reference
const $simulatorComponent = $w('#simulatorHTML');

// State to manage the simulator
let state = {
    caseIndex: null,
    userEmail: null,
    roomName: null,
    caseData: null,
    loading: true,
    caseDataSent: false
};

$w.onReady(function() {
    // 1. Initialize the page
    parseUrlParams();
    
    // 2. Load case data
    if (state.caseIndex) {
        loadCaseData();
    } else {
        showError("Missing case index. Please check the URL.");
    }
    
    // 3. Set up event listeners for the HTML component
    setupEventListeners();
});

// Parse URL parameters
function parseUrlParams() {
    state.caseIndex = wixLocation.query.index;
    state.userEmail = wixLocation.query.email;
    state.roomName = wixLocation.query.room;
    
    // Validate required parameters
    if (!state.caseIndex || !state.userEmail) {
        console.error("Missing required URL parameters");
    }
}

// Load case data from BrainBank collection
async function loadCaseData() {
    try {
        // console.log("Loading case data for index:", state.caseIndex);
        
        // Convert index to a number if it's a numeric string
        const indexValue = !isNaN(state.caseIndex) ? Number(state.caseIndex) : state.caseIndex;
        
        const results = await wixData.query("BrainBank")
            .eq("index", indexValue)
            .include("checklist", "patientInfo")
            .find();
        
        // console.log("Query results:", results);
        
        if (results.items.length > 0) {
            state.caseData = results.items[0];
            // console.log("Case data loaded:", state.caseData.title || state.caseData.caseName);
            // console.log("Full case data object:", JSON.stringify(state.caseData));
            
            // Format the data for the HTML component
            const formattedData = {
                patientInfo: formatPatientInfo(state.caseData),
                checklist: formatChecklist(state.caseData),
                roomName: state.roomName,
                userEmail: state.userEmail,
                caseIndex: state.caseIndex
            };
            
            // console.log("Formatted data being sent to HTML component:", JSON.stringify(formattedData));
            
            // Send case data to the HTML component
            $simulatorComponent.postMessage({
                type: 'caseData',
                data: formattedData
            });
            
            // Mark as sent
            state.caseDataSent = true;
            
            // console.log("Message posted to HTML component with type 'caseData'");
        } else {
            console.error("No case found with index:", state.caseIndex);
            showError("Case not found. Please check the URL.", true);
            
            // Try searching by ID as fallback
            trySearchById();
        }
    } catch (error) {
        console.error("Error loading case data:", error);
        showError("Error loading case data. Please try again later.", true);
    }
}

// Try to search for the case by _id as a fallback
async function trySearchById() {
    try {
        // Check if the index might be a Wix ID
        if (state.caseIndex && state.caseIndex.length > 20) {
            // console.log("Trying to find case by _id:", state.caseIndex);
            
            const results = await wixData.query("BrainBank")
                .eq("_id", state.caseIndex)
                .include("checklist", "patientInfo")
                .find();
            
            if (results.items.length > 0) {
                state.caseData = results.items[0];
                // console.log("Case found by _id:", state.caseData.title || state.caseData.caseName);
                
                // Send case data to the HTML component
                $simulatorComponent.postMessage({
                    type: 'caseData',
                    data: {
                        patientInfo: formatPatientInfo(state.caseData),
                        checklist: formatChecklist(state.caseData),
                        roomName: state.roomName,
                        userEmail: state.userEmail,
                        caseIndex: state.caseIndex
                    }
                });
                
                // Mark as sent
                state.caseDataSent = true;
                
                return true;
            } else {
                console.error("Case not found by _id either");
            }
        }
        
        // If ID search fails, try by title or name
        return trySearchByTitle();
    } catch (error) {
        console.error("Error in ID fallback search:", error);
        return trySearchByTitle();
    }
}

// Try to search for the case by title or name as the final fallback
async function trySearchByTitle() {
    try {
        // console.log("Trying to find case by title/name");
        
        // Try to decode the index in case it's actually a case name
        let searchTerm = state.caseIndex;
        try {
            // If it's URL encoded, decode it
            if (searchTerm.includes('%')) {
                searchTerm = decodeURIComponent(searchTerm);
            }
        } catch (e) {
            console.error("Error decoding search term:", e);
        }
        
        // Also try searching by the numeric value if it's a number
        let numericSearch = null;
        if (!isNaN(state.caseIndex)) {
            numericSearch = Number(state.caseIndex);
        }
        
        // Create base query
        let query = wixData.query("BrainBank")
            .contains("title", searchTerm)
            .or(wixData.query("BrainBank").contains("caseName", searchTerm));
        
        // Add numeric search if applicable
        if (numericSearch !== null) {
            query = query.or(wixData.query("BrainBank").eq("index", numericSearch));
        }
        
        // Search using contains to be more flexible
        const results = await query
            .include("checklist", "patientInfo")
            .find();
        
        if (results.items.length > 0) {
            state.caseData = results.items[0];
            // console.log("Case found by title/name:", state.caseData.title || state.caseData.caseName);
            
            // Send case data to the HTML component
            $simulatorComponent.postMessage({
                type: 'caseData',
                data: {
                    patientInfo: formatPatientInfo(state.caseData),
                    checklist: formatChecklist(state.caseData),
                    roomName: state.roomName,
                    userEmail: state.userEmail,
                    caseIndex: state.caseIndex
                }
            });
            
            // Mark as sent
            state.caseDataSent = true;
            
            return true;
        } else {
            console.error("Case not found by any method");
            return false;
        }
    } catch (error) {
        console.error("Error in title fallback search:", error);
        return false;
    }
}

// Format patient information
function formatPatientInfo(caseData) {
    // Return the raw patient info as a simple object
    return {
        fullInfo: caseData.patientInfo || ""
    };
}

// Format checklist items
function formatChecklist(caseData) {
    // Default structure if checklist data is missing
    const defaultChecklist = {
        dataGathering: [],
        management: [],
        interpersonalSkills: []
    };
    
    // If no checklist data, return default structure
    if (!caseData.checklist || !caseData.checklist.Checklist) {
        return defaultChecklist;
    }
    
    // Format checklist into the structure expected by the HTML component
    const formattedChecklist = {
        dataGathering: [],
        management: [],
        interpersonalSkills: []
    };
    
    // Process checklist items and organize by domain
    caseData.checklist.Checklist.forEach(item => {
        if (item.Domain === "Data Gathering") {
            formattedChecklist.dataGathering.push(item.Point);
        } else if (item.Domain === "Management") {
            formattedChecklist.management.push(item.Point);
        } else if (item.Domain === "Interpersonal Skills") {
            formattedChecklist.interpersonalSkills.push(item.Point);
        }
    });
    
    return formattedChecklist;
}

// Set up event listeners for HTML component messages
function setupEventListeners() {
    $simulatorComponent.onMessage((event) => {
        // console.log("Received message from HTML component:", event.data?.type, event.data);
        
        if (!event.data) return;
        
        switch (event.data.type) {
            case 'simulatorReady':
                // console.log("Simulator ready message received, current state:", state.caseData ? "Have case data" : "No case data");
                // If the simulator is ready and we have case data, send it only if we haven't sent it before
                if (state.caseData && !state.caseDataSent) {
                    const formattedData = {
                        patientInfo: formatPatientInfo(state.caseData),
                        checklist: formatChecklist(state.caseData),
                        roomName: state.roomName,
                        userEmail: state.userEmail,
                        caseIndex: state.caseIndex
                    };
                    
                    // console.log("Resending formatted data to HTML component:", JSON.stringify(formattedData));
                    
                    $simulatorComponent.postMessage({
                        type: 'caseData',
                        data: formattedData
                    });
                    
                    state.caseDataSent = true;
                    // console.log("Resent message to HTML component with type 'caseData'");
                }
                break;
                
            case 'submitChecklist':
                handleSubmission(event.data.data);
                break;
                
            case 'error':
                showError(event.data.message);
                break;
                
            default:
                // console.log('Unknown message type:', event.data.type);
        }
    });
}

// Handle checklist submission
async function handleSubmission(submissionData) {
    try {
        // Get the user's existing responses, if any
        const userResponsesResults = await wixData.query("userResponses")
            .eq("userID", state.userEmail)
            .find();
        
        let userResponses;
        if (userResponsesResults.items.length > 0) {
            // User already has responses, update existing record
            userResponses = userResponsesResults.items[0];
            
            // Make sure responses object exists
            if (!userResponses.responses) {
                userResponses.responses = {};
            }
            
            // Get the case name from state.caseData
            const caseName = state.caseData.caseName;
            
            // Initialize response array for this case if it doesn't exist
            if (!userResponses.responses[caseName]) {
                userResponses.responses[caseName] = [];
            }
            
            // Add new response
            userResponses.responses[caseName].push({
                timestamp: new Date().toISOString(),
                dataGathering: submissionData.responses.dataGathering,
                management: submissionData.responses.management,
                interpersonalSkills: submissionData.responses.interpersonalSkills
            });
            
            // Update last updated timestamp
            userResponses.lastUpdated = new Date();
            
            // Update record in database
            await wixData.update("userResponses", userResponses);
        } else {
            // Create new user responses record
            const caseName = state.caseData.caseName;
            const newUserResponses = {
                userID: state.userEmail,
                responses: {
                    [caseName]: [{
                        timestamp: new Date().toISOString(),
                        dataGathering: submissionData.responses.dataGathering,
                        management: submissionData.responses.management,
                        interpersonalSkills: submissionData.responses.interpersonalSkills
                    }]
                },
                lastUpdated: new Date()
            };
            
            // Insert new record
            await wixData.insert("userResponses", newUserResponses);
        }
        
        // Notify the HTML component that submission was successful
        $simulatorComponent.postMessage({
            type: 'submissionSuccess'
        });
        
    } catch (error) {
        console.error("Error saving submission:", error);
        showError("Error saving your responses. Please try again.");
    }
}

// Show error in the HTML component
function showError(message, isCritical = false) {
    $simulatorComponent.postMessage({
        type: 'showError',
        message: message,
        isCritical: isCritical
    });
} 