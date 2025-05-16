import wixData from 'wix-data';
import { currentMember } from 'wix-members';
import { orders } from 'wix-pricing-plans.v2';
import { createThreadAndRun, getStreamingResponse } from 'backend/openaiAssistant';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindow from 'wix-window';

let caseStructureCache = null;
let userResponses = null;
let threadId = null;
let runId = null;
let countdownInterval;

$w.onReady(async function () {
    const member = await currentMember.getMember();
    if (member) {
        const userName = member.contactDetails.firstName || 'Doctor'; // Fallback to 'Doctor' if no first name
        $w('#dashboardContainer').postMessage({
            type: 'welcomeUser',
            data: userName
        });
    }
    loadUserProgress().then(() => {
        updateDashboard();
    });

    // Add event listener for performance updates
    $w('#dashboardContainer').onMessage((event) => {
        if (event.data.type === 'updatePerformance') {
            updateInDepthPerformanceWidget();
        }
    });

    // Add event listener for iframe messages
    $w('#dashboardContainer').onMessage(async (event) => {
        try {
            if (!event || !event.data) {
                console.error('Invalid event received:', event);
                return;
            }

            const { type, data } = event.data;
            
            switch(type) {
                case 'aiChat':
                    try {
                        //console.log('AI Chat request received:', data);
                        
                        // Get current performance data
                        const performanceData = calculateDetailedPerformanceMetrics(userResponses.responses, caseStructureCache);
                        //console.log('Current performance data:', JSON.stringify(performanceData));
                        
                        // Add performance data to the AI request
                        const aiRequestData = {
                            message: data,
                            performanceContext: performanceData
                        };
                        //console.log('Sending AI request with performance data:', JSON.stringify(aiRequestData));
                        
                        const result = await createThreadAndRun(aiRequestData);
                        //console.log('AI response thread created:', result);
                        
                        const response = await getStreamingResponse(result.threadId, result.runId);
                        //console.log('AI streaming response received');
                        
                        $w('#dashboardContainer').postMessage({
                            type: 'aiChatResponse',
                            data: response
                        });
                    } catch (error) {
                        console.error('Error in AI chat:', error);
                        $w('#dashboardContainer').postMessage({
                            type: 'aiChatResponse',
                            data: 'Sorry, an error occurred. Please try again.'
                        });
                    }
                    break;
                case 'navigate':
                    if (data && data.url) {
                        // Navigate using wixLocation
                        wixLocationFrontend.to(data.url);
                    } else {
                        console.error('Invalid navigation data:', data);
                    }
                    break;
                case 'getCurrentPlan': {
                    const plan = await getCurrentUserPlan();
                    const allowedTopics = getAllowedTopics(plan);
                    $w('#dashboardContainer').postMessage({
                        type: 'setPlanAndTopics',
                        data: {
                            plan: plan,
                            allowedTopics: allowedTopics
                        }
                    });
                    break;
                }
                case 'saveExamDate':
                    try {
                        const member = await currentMember.getMember();
                        if (member) {
                            const userResponse = await getUserResponses(member.loginEmail);
                            userResponse.examDate = data;
                            await wixData.update("userResponses", userResponse);
                        }
                    } catch (error) {
                        console.error('Error saving exam date:', error);
                    }
                    break;
                // ... other cases ...
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
});

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

async function loadUserProgress() {
    try {
        const member = await currentMember.getMember();
        if (member) {
            userResponses = await getUserResponses(member.loginEmail);
            
            // Add this line to update streak
            updateStreak(userResponses);
            
            if (userResponses.examDate) {
                $w('#dashboardContainer').postMessage({
                    type: 'initializeExamDate',
                    data: userResponses.examDate
                });
            }

            caseStructureCache = await getCaseStructure();
            
            // Send both the case structure and the user responses
            $w('#dashboardContainer').postMessage({
                type: 'initializeCaseMap',
                data: {
                    caseStructure: caseStructureCache,
                    userResponses: userResponses
                }
            });
            
            const communityProgress = await getCommunityProgress();
            const progressData = calculateProgress(userResponses.responses, caseStructureCache, communityProgress);
            
            updateProgressChart(progressData);
            
            const widgetData = calculateWidgetData(userResponses.responses, caseStructureCache);
            updateProgressPerformanceWidget(widgetData, progressData.topic);
            
            updateInDepthPerformanceWidget();
        } else {
            console.error("User not logged in");
            sendEmptyChartData();
            updateProgressPerformanceWidget(
                { progress: { total: 0, completed: 0 }, performance: { dataGathering: 0, management: 0, interpersonalSkills: 0 } },
                {}
            );
        }
    } catch (error) {
        console.error("Error loading user progress:", error);
        sendEmptyChartData();
        updateProgressPerformanceWidget(
            { progress: { total: 0, completed: 0 }, performance: { dataGathering: 0, management: 0, interpersonalSkills: 0 } },
            {}
        );
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

function calculateDetailedPerformanceMetrics(userResponses, caseStructure) {
    let overallScore = 0;
    let casesCompleted = 0;
    let domainScores = { dataGathering: 0, management: 0, interpersonalSkills: 0 };
    let topicScores = {};
    let performanceOverTime = {
        labels: [],
        dataGathering: [],
        management: [],
        interpersonalSkills: []
    };

    // Sort responses by date
    let sortedResponses = [];
    caseStructure.forEach(caseItem => {
        if (userResponses[caseItem.caseName]) {
            userResponses[caseItem.caseName].forEach(response => {
                sortedResponses.push({
                    date: new Date(response.timestamp),
                    scores: {
                        dataGathering: parseFloat(response.dataGathering.score),
                        management: parseFloat(response.management.score),
                        interpersonalSkills: parseFloat(response.interpersonalSkills.score)
                    }
                });
            });
        }
    });
    sortedResponses.sort((a, b) => a.date - b.date);

    // Populate performanceOverTime
    sortedResponses.forEach(response => {
        // Use ISO format 'YYYY-MM-DD' for consistency
        performanceOverTime.labels.push(response.date.toISOString().split('T')[0]);
        performanceOverTime.dataGathering.push(response.scores.dataGathering);
        performanceOverTime.management.push(response.scores.management);
        performanceOverTime.interpersonalSkills.push(response.scores.interpersonalSkills);
    });

    caseStructure.forEach(caseItem => {
        if (userResponses[caseItem.caseName] && userResponses[caseItem.caseName].length > 0) {
            const latestResponse = userResponses[caseItem.caseName][userResponses[caseItem.caseName].length - 1];
            casesCompleted++;

            // Calculate overall score (now out of 12)
            const caseScore = parseFloat(latestResponse.dataGathering.score) +
                              parseFloat(latestResponse.management.score) +
                              parseFloat(latestResponse.interpersonalSkills.score);
            overallScore += caseScore;

            // Update domain scores
            domainScores.dataGathering += parseFloat(latestResponse.dataGathering.score);
            domainScores.management += parseFloat(latestResponse.management.score);
            domainScores.interpersonalSkills += parseFloat(latestResponse.interpersonalSkills.score);

            // Update topic scores (now out of 12)
            if (!topicScores[caseItem.topic]) {
                topicScores[caseItem.topic] = { total: 0, count: 0 };
            }
            topicScores[caseItem.topic].total += caseScore;
            topicScores[caseItem.topic].count++;
        }
    });

    // Calculate averages
    overallScore /= casesCompleted || 1;
    Object.keys(domainScores).forEach(domain => {
        domainScores[domain] /= casesCompleted || 1;
    });
    Object.keys(topicScores).forEach(topic => {
        topicScores[topic] = (topicScores[topic].total / topicScores[topic].count);
    });

    Object.keys(topicScores).forEach(topic => {
        // Convert topic names when creating the final array
        const formattedTopic = camelCaseToSentence(topic);
        topicScores[formattedTopic] = topicScores[topic];
        if (formattedTopic !== topic) {
            delete topicScores[topic];
        }
    });

    return {
        summary: {
            overallScore,
            casesCompleted
        },
        overTime: performanceOverTime,
        domain: domainScores,
        topics: Object.entries(topicScores).map(([name, score]) => ({ name, score }))
    };
}

function updateInDepthPerformanceWidget() {
    if (!userResponses || !caseStructureCache) {
        console.error("User responses or case structure not loaded");
        return;
    }

    const performanceData = calculateDetailedPerformanceMetrics(userResponses.responses, caseStructureCache);
    $w('#dashboardContainer').postMessage({ 
        type: 'updateInDepthPerformance', 
        data: performanceData 
    });
}

function calculateWidgetData(userResponses, caseStructure) {
    let totalCases = 0;
    let completedCases = 0;
    let domainScores = {
        dataGathering: [],
        management: [],
        interpersonalSkills: []
    };

    caseStructure.forEach(caseItem => {
        totalCases++;
        if (userResponses[caseItem.caseName] && userResponses[caseItem.caseName].length > 0) {
            completedCases++;
            const latestResponse = userResponses[caseItem.caseName][userResponses[caseItem.caseName].length - 1];
            domainScores.dataGathering.push(parseFloat(latestResponse.dataGathering.score));
            domainScores.management.push(parseFloat(latestResponse.management.score));
            domainScores.interpersonalSkills.push(parseFloat(latestResponse.interpersonalSkills.score));
        }
    });

    const calculateAverage = (scores) => scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
        progress: {
            total: totalCases,
            completed: completedCases
        },
        performance: {
            dataGathering: calculateAverage(domainScores.dataGathering),
            management: calculateAverage(domainScores.management),
            interpersonalSkills: calculateAverage(domainScores.interpersonalSkills)
        }
    };
}

function updateProgressPerformanceWidget(data, topicProgress) {
    const topics = {};
    Object.entries(topicProgress).forEach(([topic, progress]) => {
        topics[topic] = (progress.completed / progress.total) * 100;
    });

    $w('#dashboardContainer').postMessage({
        type: 'updateProgressPerformance',
        data: {
            progress: data.progress,
            performance: data.performance,
            topics: topics
        }
    });
}

function getCaseStructureForCase(caseName) {
    if (!caseStructureCache) {
        console.error("Case structure cache is not initialized");
        return null;
    }
    return caseStructureCache.find(caseItem => caseItem.caseName === caseName);
}

async function getCommunityProgress() {
    try {
        const results = await wixData.query("userResponses")
            .limit(1000)
            .find();
        
        const communityProgress = {
            topic: {},
            category: {},
            subcategory: {}
        };
        
        if (!results || !results.items || !results.items.length) {
            return communityProgress;
        }
        
        results.items.forEach(userResponse => {
            if (!userResponse || !userResponse.responses) return;
            
            Object.keys(userResponse.responses).forEach(caseName => {
                const caseStructure = getCaseStructureForCase(caseName);
                if (caseStructure) {
                    ['topic', 'category', 'subCategory'].forEach(level => {
                        const key = level === 'subCategory' ? 'subcategory' : level;
                        const levelValue = caseStructure[level];
                        
                        if (!communityProgress[key][levelValue]) {
                            communityProgress[key][levelValue] = { total: 0, completed: 0 };
                        }
                        
                        communityProgress[key][levelValue].total++;
                        communityProgress[key][levelValue].completed++;
                    });
                }
            });
        });
        
        if (results.items.length > 0) {
            Object.keys(communityProgress).forEach(level => {
                Object.keys(communityProgress[level]).forEach(item => {
                    const avg = communityProgress[level][item].completed / results.items.length;
                    communityProgress[level][item].average = Math.round(avg * 100) / 100;
                });
            });
        }
        
        return communityProgress;
    } catch (error) {
        console.error("Error fetching community progress:", error);
        return {
            topic: {},
            category: {},
            subcategory: {}
        };
    }
}

async function getUserResponses(userID) {
    const results = await wixData.query("userResponses")
        .eq('userID', userID)
        .find();
    return results.items.length > 0 ? results.items[0] : { userID, responses: {}, examDate: null };
}

async function getCaseStructure() {
    try {
        const results = await wixData.query("BrainBank")
            .limit(1000)
            .find();
        
        return results.items.map(item => ({
            // Use the raw values as keys for matching
            caseName: item.caseName,
            // Use the formatted version for display purposes
            displayCaseName: camelCaseToSentence(item.caseName),
            topic: item.topic,
            topicFormatted: camelCaseToSentence(item.topic),
            category: item.category,
            categoryFormatted: camelCaseToSentence(item.category),
            subCategory: item.subCategory,
            subCategoryFormatted: camelCaseToSentence(item.subCategory),
            isNewCase: item.NewCase || false,
            // Include synonyms array if it exists
            synonyms: item.synonyms || []
        }));
    } catch (error) {
        console.error("Error fetching case structure:", error);
        return [];
    }
}

function calculateProgress(userResponses, caseStructure, communityProgress = {}) {
    const progress = {
        topic: {},
        category: {},
        subcategory: {}
    };

    if (!caseStructure || !Array.isArray(caseStructure)) {
        console.error("Invalid case structure");
        return progress;
    }

    // First pass: collect all data
    caseStructure.forEach(caseItem => {
        if (!caseItem) return;
        
        ['topic', 'category', 'subCategory'].forEach(level => {
            const key = level === 'subCategory' ? 'subcategory' : level;
            const levelValue = caseItem[level];
            
            if (!levelValue) return;
            
            const formattedValue = camelCaseToSentence(levelValue);
            
            if (!progress[key][formattedValue]) {
                progress[key][formattedValue] = { 
                    total: 0, 
                    completed: 0,
                    scores: {
                        dataGathering: [],
                        management: [],
                        interpersonalSkills: []
                    },
                    topic: camelCaseToSentence(caseItem.topic),
                    communityAverage: communityProgress?.[key]?.[levelValue]?.average || 0
                };
            }
            
            progress[key][formattedValue].total++;

            if (userResponses && userResponses[caseItem.caseName]?.length > 0) {
                progress[key][formattedValue].completed++;
                const latestResponse = userResponses[caseItem.caseName][userResponses[caseItem.caseName].length - 1];
                progress[key][formattedValue].scores.dataGathering.push(parseFloat(latestResponse.dataGathering.score));
                progress[key][formattedValue].scores.management.push(parseFloat(latestResponse.management.score));
                progress[key][formattedValue].scores.interpersonalSkills.push(parseFloat(latestResponse.interpersonalSkills.score));
            }
        });
    });

    // Calculate averages for each domain
    Object.values(progress).forEach(levelData => {
        Object.values(levelData).forEach(item => {
            const avgScores = {};
            Object.entries(item.scores).forEach(([domain, scores]) => {
                avgScores[domain] = scores.length > 0 
                    ? scores.reduce((a, b) => a + b, 0) / scores.length 
                    : 0;
            });
            item.averageScores = avgScores;
        });
    });

    // Format data for charts
    const formattedData = {
        topic: { labels: [], totalCases: [], completedCases: [], communityAverages: [], topicMapping: {}, domainScores: {} },
        category: { labels: [], totalCases: [], completedCases: [], communityAverages: [], topicMapping: {}, domainScores: {} },
        subcategory: { labels: [], totalCases: [], completedCases: [], communityAverages: [], topicMapping: {}, domainScores: {} }
    };

    Object.entries(progress).forEach(([level, data]) => {
        Object.entries(data).forEach(([name, stats]) => {
            formattedData[level].labels.push(name);
            formattedData[level].totalCases.push(stats.total);
            formattedData[level].completedCases.push(stats.completed);
            formattedData[level].communityAverages.push(stats.communityAverage);
            formattedData[level].domainScores[name] = stats.averageScores;
            if (level !== 'topic') {
                formattedData[level].topicMapping[formattedData[level].labels.length - 1] = stats.topic;
            }
        });
    });

    return formattedData;
}

function updateProgressChart(progressData) {
    // Send progress chart data for the overview progress chart only.
    $w('#dashboardContainer').postMessage({ 
        type: 'updateProgressChart',
        data: progressData
    });
    
    // The detailed progress messages are no longer sent since the info is now integrated in the case map.
}

function sendEmptyChartData() {
    const emptyData = {
        topic: { labels: ['No Data'], totalCases: [0], completedCases: [0], communityAverages: [0], topicMapping: {} },
        category: { labels: ['No Data'], totalCases: [0], completedCases: [0], communityAverages: [0], topicMapping: {} },
        subcategory: { labels: ['No Data'], totalCases: [0], completedCases: [0], communityAverages: [0], topicMapping: {} }
    };

    // Send empty data for both charts
    $w('#dashboardContainer').postMessage({ 
        type: 'updateProgressChart',
        data: emptyData
    });

    // Send empty data for the detailed progress chart
    Object.entries(emptyData).forEach(([level, data]) => {
        $w('#dashboardContainer').postMessage({
            type: 'updateDetailedProgress',
            data: [
                level,
                data.labels,
                data.totalCases,
                data.completedCases,
                data.communityAverages,
                data.topicMapping
            ]
        });
    });
}

// Add new function to update dashboard
function updateDashboard() {
    if (!userResponses || !caseStructureCache) {
        console.error("User responses or case structure not loaded");
        return;
    }

    const performanceData = calculateDetailedPerformanceMetrics(userResponses.responses, caseStructureCache);
    updatePerformanceData(performanceData);
}

function updatePerformanceData(data) {
    if (!data) return;
    
    // Modify the timeline data format to match what the chart expects
    const timelineData = data.overTime ? {
        labels: data.overTime.labels,
        dataGathering: data.overTime.dataGathering,
        management: data.overTime.management,
        interpersonalSkills: data.overTime.interpersonalSkills
    } : null;
    
    $w('#dashboardContainer').postMessage({
        type: 'updateDashboard',
        data: {
            progress: data.summary ? {
                completed: data.summary.casesCompleted,
                total: caseStructureCache?.length || 0
            } : null,
            domain: data.domain || null,
            overTime: timelineData,  // Changed from 'timeline' to 'overTime' to match the expected property
            topics: data.topics || null
        }
    });
}

// Add streak handling to your existing loadUserProgress function
function updateStreak(userResponses) {
    if (!userResponses || !userResponses.responses) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all practice dates and sort them
    let practiceDates = [];
    Object.values(userResponses.responses).forEach(caseResponses => {
        if (Array.isArray(caseResponses)) {
            caseResponses.forEach(response => {
                const practiceDate = new Date(response.timestamp);
                practiceDate.setHours(0, 0, 0, 0);
                practiceDates.push(practiceDate.getTime());
            });
        }
    });

    // Sort and remove duplicates (same day practices)
    practiceDates = [...new Set(practiceDates)].sort((a, b) => a - b);

    // Calculate best streak by looking at consecutive days
    let bestStreak = 0;
    let currentStreak = 0;
    let previousDate = null;

    practiceDates.forEach(timestamp => {
        const currentDate = new Date(timestamp);
        
        if (!previousDate) {
            currentStreak = 1;
        } else {
            const diffDays = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreak++;
            } else if (diffDays > 1) {
                currentStreak = 1;
            }
        }
        
        bestStreak = Math.max(bestStreak, currentStreak);
        previousDate = currentDate;
    });

    // Calculate current streak
    const lastPracticeDate = practiceDates.length > 0 ? new Date(Math.max(...practiceDates)) : null;
    let currentActiveStreak = 0;

    if (lastPracticeDate) {
        const diffTime = Math.abs(today - lastPracticeDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0 || diffDays === 1) {
            // Count backwards from the last practice date to find current streak
            let streakDate = lastPracticeDate;
            currentActiveStreak = 1;
            
            for (let i = practiceDates.length - 2; i >= 0; i--) {
                const prevDate = new Date(practiceDates[i]);
                const daysDiff = Math.round((streakDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 1) {
                    currentActiveStreak++;
                    streakDate = prevDate;
                } else {
                    break;
                }
            }
        }
    }

    // Format last practice date
    const formattedDate = lastPracticeDate ? lastPracticeDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) : 'Never';

    // Send streak data to the dashboard
    $w('#dashboardContainer').postMessage({
        type: 'updateStreak',
        data: {
            currentStreak: currentActiveStreak,
            bestStreak: bestStreak,
            lastPractice: formattedDate
        }
    });

    // Update the database with new streak values
    userResponses.currentStreak = currentActiveStreak;
    userResponses.bestStreak = bestStreak;
    userResponses.lastPracticeDate = lastPracticeDate ? lastPracticeDate.toISOString() : null;
    wixData.update("userResponses", userResponses);
}