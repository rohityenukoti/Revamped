import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";
import wixData from 'wix-data';

export const saveChatHistoryToMediaManager = webMethod(
    Permissions.SiteMember,
    async (chatHistory, caseName, userEmail) => {
        try {
            // The chatHistory is now already converted to plain text in the frontend
            const plainTextHistory = chatHistory;

            if (!userEmail) {
                throw new Error("User email not provided");
            }

            const timestamp = new Date().toISOString();

            // Create a buffer from the plain text history
            const buffer = Buffer.from(plainTextHistory, 'utf8');
            
            // Create a unique filename for the chat history
            const fileName = `${caseName}_${timestamp.replace(/:/g, '_')}.txt`;
            
            // Create a user-specific path by sanitizing the email
            const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const userPath = `/chat-histories/${sanitizedEmail}`;
            
            // Upload the file to Media Manager in the user's subfolder
            const uploadResult = await mediaManager.upload(
                userPath,
                buffer,
                fileName,
                {
                    mediaOptions: {
                        mimeType: "text/plain",
                        mediaType: "document"
                    },
                    metadataOptions: {
                        isPrivate: false,
                        isVisitorUpload: false,
                        context: {
                            userEmail: userEmail,
                            caseName: caseName,
                            timestamp: timestamp
                        }
                    }
                }
            );

            // Convert Wix media URL to direct view URL
            // Example input: wix:document://v1/72e91f_a26065e386bd4da895f7a97092d79e8e.txt/filename.txt
            // Example output: https://38c04ad5-82f1-447f-83fd-22034030352a.usrfiles.com/ugd/72e91f_a26065e386bd4da895f7a97092d79e8e.txt
            const urlParts = uploadResult.fileUrl.split('/');
            const fileCode = urlParts[3]; // Get the part after v1/
            const directViewUrl = `https://38c04ad5-82f1-447f-83fd-22034030352a.usrfiles.com/ugd/${fileCode}`;

            // Get existing user responses record
            let userResponsesRecord = await wixData.query("userResponses")
                .eq("userID", userEmail)
                .find();
            
            let record;
            if (userResponsesRecord.items.length > 0) {
                record = userResponsesRecord.items[0];
                if (!record.chatHistory) {
                    record.chatHistory = {};
                }
                if (!record.chatHistory[caseName]) {
                    record.chatHistory[caseName] = {};
                }
            } else {
                record = { userID: userEmail, chatHistory: { [caseName]: {} } };
            }

            // Save the direct view URL
            record.chatHistory[caseName][timestamp] = directViewUrl;

            // Update or insert the record
            if (userResponsesRecord.items.length > 0) {
                await wixData.update("userResponses", record);
            } else {
                await wixData.insert("userResponses", record);
            }

            return { success: true, fileUrl: directViewUrl };
        } catch (error) {
            console.error("Error saving chat history:", error);
            return { success: false, error: error.message };
        }
    }
); 