import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { currentMember } from 'wix-members';

// UI Elements
const $caseEditorHTML = $w('#caseEditorHTML');

// State
let currentCase = null;

$w.onReady(function () {
    // Initialize the editor
    loadTreeViewData();
    
    // Listen for messages from the HTML component
    $caseEditorHTML.onMessage((event) => {
        if (event.data.type === 'topicSelected') {
            handleTopicSelection(event.data.topicId);
        } else if (event.data.type === 'caseSelected') {
            handleCaseSelection(event.data.caseName);
        } else if (event.data.type === 'saveSection') {
            saveSection(event.data.section, event.data.caseName, event.data.data);
        }
    });
    
    // Check URL parameters for case selection
    const urlCase = wixLocationFrontend.query["case"];
    if (urlCase) {
        loadCaseData(urlCase);
    }
});

// Load tree view data
async function loadTreeViewData() {
    try {
        const treeStructure = await fetchTreeStructure();
        
        const topLevelTreeData = Object.keys(treeStructure).map(topic => ({
            id: topic,
            name: camelCaseToSentence(topic),
            type: 'topic',
            children: null
        }));

        $caseEditorHTML.postMessage({ type: 'setTreeData', data: topLevelTreeData });
    } catch (err) {
        console.error("Error loading initial tree view data:", err);
    }
}

// Fetch tree structure from database
async function fetchTreeStructure() {
    try {
        const results = await wixData.query("BrainBank")
            .limit(1000)
            .find();

        const treeStructure = {};
        results.items.forEach(item => {
            const { topic, category, subCategory, caseName, caseUID, lastEdited } = item;

            if (isRedundantStructure(topic, category, subCategory)) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = [];
                }
                treeStructure[topic].push({ caseName, caseUID, lastEdited });
            } else if (category === subCategory) {
                if (!treeStructure[topic]) {
                    treeStructure[topic] = {};
                }
                if (!treeStructure[topic][category]) {
                    treeStructure[topic][category] = [];
                }
                treeStructure[topic][category].push({ caseName, caseUID, lastEdited });
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
                treeStructure[topic][category][subCategory].push({ caseName, caseUID, lastEdited });
            }
        });

        return treeStructure;
    } catch (error) {
        console.error("Error fetching tree structure:", error);
        return {};
    }
}

// Check if structure is redundant (topic = category = subCategory)
function isRedundantStructure(topic, category, subCategory) {
    return topic === category && category === subCategory;
}

// Convert camelCase to sentence case
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

// Handle topic selection
async function handleTopicSelection(topicId) {
    try {
        const treeStructure = await fetchTreeStructure();
        const [topic, categoryId] = topicId.split(':');
        const topicData = treeStructure[topic];
        
        if (Array.isArray(topicData)) {
            // Direct cases under topic
            const transformedData = transformTopicDataForTreeView(topic, topicData);
            $caseEditorHTML.postMessage({ 
                type: 'updateTopic', 
                topic: topic, 
                data: transformedData 
            });
        } else if (categoryId && Array.isArray(topicData[categoryId])) {
            // Direct cases under category
            const transformedData = [{
                id: topicId,
                name: camelCaseToSentence(categoryId),
                type: 'category',
                children: transformTopicDataForTreeView(topic, {[categoryId]: topicData[categoryId]})
            }];
            $caseEditorHTML.postMessage({ 
                type: 'updateTopic', 
                topic: topic, 
                data: transformedData 
            });
        } else if (topicData) {
            const transformedData = transformTopicDataForTreeView(topic, topicData);
            $caseEditorHTML.postMessage({ 
                type: 'updateTopic', 
                topic: topic, 
                data: transformedData 
            });
        } else {
            console.error("Topic not found:", topic);
        }
    } catch (err) {
        console.error("Error handling topic selection:", err);
    }
}

// Transform topic data for tree view
function transformTopicDataForTreeView(topic, topicData) {
    const transformedData = [];

    if (Array.isArray(topicData)) {
        return topicData.map(caseItem => ({
            id: `caseName:${caseItem.caseName}`,
            name: camelCaseToSentence(caseItem.caseName),
            type: 'caseName',
            caseUID: caseItem.caseUID,
            hasBeenEdited: Boolean(caseItem.lastEdited)
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
                    caseUID: caseItem.caseUID,
                    hasBeenEdited: Boolean(caseItem.lastEdited)
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
                        caseUID: caseItem.caseUID,
                        hasBeenEdited: Boolean(caseItem.lastEdited)
                    }))
                };
                categoryItem.children.push(subCategoryItem);
            });

            transformedData.push(categoryItem);
        }
    });

    return transformedData;
}

// Handle case selection
async function handleCaseSelection(selectedId) {
    if (selectedId.includes('caseName:')) {
        const caseName = selectedId.split(':')[1];
        await loadCaseData(caseName);
        updateUrl(caseName);
    }
}

// Load case data
async function loadCaseData(caseName) {
    try {
        //console.log('Loading case data for:', caseName);
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .include("topic", "candidateInfo", "checklist", "inTimeSections", "findingsImage", "findingsText", "patientInfo", "keyPoints")
            .find();
        
        //console.log('Query results:', results);
        
        if (results.items.length > 0) {
            const caseData = results.items[0];
            //console.log('Raw case data:', caseData);
            
            // Fix the nested candidateInfo structure
            if (caseData.candidateInfo && caseData.candidateInfo.candidateInfo && Array.isArray(caseData.candidateInfo.candidateInfo)) {
                caseData.candidateInfo = caseData.candidateInfo.candidateInfo[0] || {
                    whereAreYou: '',
                    whoYourPatientIs: '',
                    otherInformation: '',
                    whatYouMustDo: '',
                    specialNote: ''
                };
            } else if (!caseData.candidateInfo) {
                caseData.candidateInfo = {
                    whereAreYou: '',
                    whoYourPatientIs: '',
                    otherInformation: '',
                    whatYouMustDo: '',
                    specialNote: ''
                };
            }
            
            //console.log('Processed candidateInfo:', caseData.candidateInfo);
            currentCase = caseData;
            
            // Send case data to HTML component
            //console.log('Sending case data to HTML component:', {
            //    type: 'loadCaseData',
            //    caseData: caseData
            //});
            
            $caseEditorHTML.postMessage({ 
                type: 'loadCaseData', 
                caseData: caseData 
            });
            
            // Highlight the case in the tree view
            const casePath = await findCasePath(caseName);
            if (casePath) {
                $caseEditorHTML.postMessage({ 
                    type: 'highlightCase', 
                    topic: casePath[0],
                    category: casePath[1],
                    subCategory: casePath[2],
                    caseName: casePath[3]
                });
            }
        } else {
            console.error("Case not found:", caseName);
        }
    } catch (error) {
        console.error("Error loading case data:", error);
        console.error("Error details:", error.message);
    }
}

// Update URL parameters for case selection
function updateUrl(caseName) {
    wixLocationFrontend.queryParams.add({ "case": caseName });
}

// Find the path to a case in the tree structure
async function findCasePath(caseName) {
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

// Get current user information
async function getCurrentUserInfo() {
    try {
        const member = await currentMember.getMember();
        return member.loginEmail || "Unknown User";
    } catch (error) {
        console.error("Error getting current user:", error);
        return "Unknown User";
    }
}

// Save section data to the database
async function saveSection(section, caseName, data) {
    try {
        //console.log('Saving section:', section);
        //console.log('Case name:', caseName);
        //console.log('Data to save:', data);
        
        // Get the case record
        const results = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .find();
        
        //console.log('Found case record:', results);
        
        if (results.items.length === 0) {
            console.error("Case not found:", caseName);
            $caseEditorHTML.postMessage({ 
                type: 'saveConfirmation', 
                section: section,
                success: false 
            });
            return;
        }
        
        const caseRecord = results.items[0];
        //console.log('Original case record:', caseRecord);
        
        // Add last edited information
        caseRecord.lastEdited = new Date();
        caseRecord.editedBy = await getCurrentUserInfo();
        
        // Update the appropriate section based on the section parameter
        switch(section) {
            case 'CandidateInfo':
                // Update to maintain the array structure
                caseRecord.candidateInfo = {
                    candidateInfo: [{
                        whereAreYou: data.whereAreYou || '',
                        whoYourPatientIs: data.whoYourPatientIs || '',
                        otherInformation: data.otherInformation || '',
                        whatYouMustDo: data.whatYouMustDo || '',
                        specialNote: data.specialNote || ''
                    }]
                };
                break;
                
            // Remove the FindingsImage case since it involves mediaManager
            // case 'FindingsImage':
            //     if (data && data.file) {
            //         // Upload the image file
            //         const uploadedFile = await mediaManager.upload(data.file.name, data.file, {
            //             mediaOptions: {
            //                 mimeType: data.file.type,
            //                 mediaType: "image"
            //             }
            //         });
            //         caseRecord.findingsImage = uploadedFile.fileUrl;
            //     }
            //     break;
                
            case 'FindingsText':
                caseRecord.findingsText = data;
                break;
                
            case 'PatientInfo':
                caseRecord.patientInfo = data;
                break;
                
            case 'KeyPoints':
                caseRecord.keyPoints = data;
                break;
                
            case 'Checklist':
                if (!caseRecord.checklist) {
                    caseRecord.checklist = {};
                }
                caseRecord.checklist.Checklist = data;
                break;
                
            case 'InTimeSections':
                if (!caseRecord.inTimeSections) {
                    caseRecord.inTimeSections = {};
                }
                caseRecord.inTimeSections.Consultation = data;
                break;
                
            default:
                console.error("Unknown section:", section);
                $caseEditorHTML.postMessage({ 
                    type: 'saveConfirmation', 
                    section: section,
                    success: false 
                });
                return;
        }
        
        // Save the updated record
        //console.log('Saving updated case record:', caseRecord);
        await wixData.update("BrainBank", caseRecord);
        
        // Reload the case data to get the updated version
        const updatedResults = await wixData.query("BrainBank")
            .eq("caseName", caseName)
            .include("topic", "candidateInfo", "checklist", "inTimeSections", "findingsImage", "findingsText", "patientInfo", "keyPoints")
            .find();
            
        const updatedCaseData = updatedResults.items[0];
        currentCase = updatedCaseData;
        
        // Send confirmation back to the HTML component
        $caseEditorHTML.postMessage({ 
            type: 'saveConfirmation', 
            section: section,
            success: true,
            updatedData: updatedCaseData
        });
        
    } catch (error) {
        console.error("Error saving section:", error);
        console.error("Error details:", error.message);
        $caseEditorHTML.postMessage({ 
            type: 'saveConfirmation', 
            section: section,
            success: false 
        });
    }
}