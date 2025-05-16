import { Permissions, webMethod } from "wix-web-module";
import { secrets } from "wix-secrets-backend.v2";
import { elevate } from "wix-auth";

const elevatedGetSecretValue = elevate(secrets.getSecretValue);

export const getAzureConfig = webMethod(Permissions.Anyone, async () => {
    try {
        const [region, apiKey, endpoint, speechKey] = await Promise.all([
            elevatedGetSecretValue("azureSpeechRegion"),
            elevatedGetSecretValue("azureOpenAIApiKey"),
            elevatedGetSecretValue("azureOpenAIEndpoint"),
            elevatedGetSecretValue("azureSpeechApiKey")
        ]);

        return {
            speechRegion: region,
            openAIEndpoint: endpoint,
            speechApiKey: speechKey,
            openAIApiKey: apiKey,
            // Don't return sensitive API keys to frontend
            hasValidKeys: Boolean(apiKey && speechKey)
        };
    } catch (error) {
        console.error("Error fetching Azure configuration:", error);
        return {
            speechRegion: null,
            openAIEndpoint: null,
            hasValidKeys: false
        };
    }
}); 
