import { AzureOpenAI } from 'openai';

const openai = new AzureOpenAI({
  apiKey: '30ec19e007634123b1d622055a349f6d',
  endpoint: 'https://turingmedschooltest.openai.azure.com/',
  apiVersion: "2024-05-01-preview", 
});

const ASSISTANT_ID = 'asst_x8UeISJxCE22xN8vKgBdFbko'; // Replace with your actual assistant ID

export async function createThreadAndRun(userMessage, existingThreadId = null) {
  try {
    //console.log('Creating thread with message:', typeof userMessage === 'object' ? JSON.stringify(userMessage) : userMessage);
    
    let threadId = existingThreadId;

    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      //console.log('Created new thread:', threadId);
    } else {
      //console.log('Using existing thread:', threadId);
    }

    // If userMessage is an object with performanceContext, format it appropriately
    let messageContent = typeof userMessage === 'object' ? 
      `User Question: ${userMessage.message || userMessage}\n\nPerformance Context: ${JSON.stringify(userMessage.performanceContext, null, 2)}` :
      userMessage;

    console.log('Sending formatted message to thread:', messageContent);

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    //console.log('Created run:', run.id);

    return { threadId, runId: run.id };
  } catch (error) {
    console.error('Error in createThreadAndRun:', error);
    throw error;
  }
}

export async function getStreamingResponse(threadId, runId) {
  const maxRetries = 10; // Increased from 5 to 10
  const baseDelay = 1000; // 1 second
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      //console.log(`Attempt ${attempt + 1}: Retrieving run status for thread ${threadId}, run ${runId}`);
      let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
      //console.log(`Initial run status: ${runStatus.status}`);
      
      let startTime = Date.now();
      let checkCount = 0;
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error('Maximum wait time exceeded');
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(10000, Math.pow(2, checkCount) * 1000))); // Exponential backoff, max 10 seconds
        checkCount++;
        //console.log(`Check ${checkCount}: Retrieving updated run status`);
        runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
        //console.log(`Updated run status: ${runStatus.status}`);
      }

      if (runStatus.status === 'completed') {
        //console.log('Run completed. Retrieving messages.');
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessages = messages.data.filter(message => message.role === 'assistant');
        //console.log(`Retrieved ${assistantMessages.length} assistant messages`);
        return assistantMessages[0].content[0].text.value;
      }

      if (runStatus.status === 'failed') {
        console.error('Assistant run failed');
        throw new Error('Assistant run failed');
      }
    } catch (error) {
      console.error(`Error in attempt ${attempt + 1}:`, error);
      if (error.response && error.response.status === 504 || error.message === 'Maximum wait time exceeded') {
        const delay = Math.min(30000, Math.pow(2, attempt) * baseDelay); // Max delay of 30 seconds
        //console.log(`Error occurred. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  console.error('Max retries reached. Unable to get response from assistant.');
  throw new Error('Max retries reached. Unable to get response from assistant.');
}