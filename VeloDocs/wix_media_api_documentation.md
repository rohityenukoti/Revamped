Introduction
To use the Media API, import wixMedia from the wix-media-backend module:

Copy
import wixMedia from "wix-media-backend";
Did this help?

Yes

No
Importing and Uploading Files
When you import or upload a file, it's not immediately available, meaning you can't manage or use the file straight away. Files can take time to import or upload and be processed. This is true even though the function used to import or upload a file returns a successful response.

To run code when a file finishes processing successfully, use the onFileUploaded() event. For audio or video files, use onAudioTranscoded() or onVideoTranscoded().

Using context
The import(), upload(), and getUploadUrl() functions have a parameter called context. Arguments passed to this parameter are included only in the wix-media-backend event bodies.

Use context to pass information to the events that isn't contained in the file descriptor object.

context use case
Here is a sample flow to show how you could use context effectively.

There is a form on a site that sends site visitors a confirmation email with the details they submitted in the form. One of the form fields is an image URL. In the email, we want to send a Wix download URL for the image, not the original image URL. This means we can only send the email when the image file is ready to download.

To implement this, we use the following flow:

When the user submits the form, send the form information to a data collection, getting back the form data's _id.
Use import() to upload the image to the Media Manager. Include the context parameter as follows:
Copy
{
  "context": {
    "origin": "formBuilder",
    "externalIds": ["_id"]
  }
}
Add the onFileUploaded() event in your events.js file, and implement the following steps to handle the event:
Check that the value for context.origin is formBuilder. We don't want to run this code if media was added from a different source.
Use the _id to retrieve the form details from the CMS.
Get a download URL for the image.
Send the confirmation email with the form details and the download URL.
Did this help?

Yes

No
mediaManager
mediaManager
MediaManager
Read-only
The mediaManager module contains functionality for working with the media that is stored in your site's Media Manager.

To use the Media Manager API, import mediaManager from the wix-media-backend module:

import { mediaManager } from 'wix-media-backend';

Introduction
Wix Media events are triggered when certain events occur with files created using the Media API. You can write event handlers that react to these events. Event handler functions receive data that corresponds to the event that has occurred. Use event handlers to create custom responses to media events.

To add a media event handler, add an events.js file to the Backend section of your site if one doesn't already exist. All event handler functions for your site are defined in this file.

Event handler functions are defined using the following pattern:

Copy
export function <wixAppName>_<eventName>(event) { }
For example, an event handler that handles a file being uploaded to the Media Manager looks like this:

Copy
export function wixMediaManager_onFileUploaded(event) {}
Note: Backend events don't work when previewing your site.

Did this help?

Yes

No
onAudioTranscoded( )
An event that triggers when an audio file has completed transcoding.

The onAudioTranscoded() event handler runs when an uploaded audio file has finished transcoding. Audio files that have been imported aren't immediately available until the transcoding has completed.

It is fired after the onFileUploaded event, and after the transcoding has completed. The FileEvent object contains information about the uploaded audio file and the upload context.

Note: Backend events don't work when previewing your site.

Method Declaration
Copy
function onAudioTranscoded(event: FileEvent): void;
Method Parameters
event
FileEvent
Required
The uploaded file information.

Show Child Properties
Example shown:
An event when an audio file has been transcoded
JavaScript
// Place this code in the events.js file
// of your site's Backend section.

export function wixMediaManager_onAudioTranscoded(event) {
  let audioFileInfo = event.fileInfo;
  let fileUrl = event.fileInfo.fileUrl;
  let size = event.fileInfo.sizeInBytes;
}

/* Full event object:
 *  {
 *     "fileInfo": {
 *        "mediaType": "audio",
 *        "mimeType": "audio/mpeg",
 *        "sourceUrl": "https://somedomain.com/img/original-name.mp3",
 *        "fileUrl": "wix:audio://v1/2123bc_6aec991ee66c4c16a783433cc7dca232.mp3/fileUrl.mp3#"
 *        "hash": "5a9a91184e611dae3fed162b8787ce5f",
 *        "opStatus": "READY",
 *        "originalFileName": "original-name.mp3",
 *        "sizeInBytes": 8414449,
 *        "isPrivate": false
 *     },
 *     "context": {
 *       "someKey1": "someValue1",
 *       "someKey2": "someValue2"
 *     }
 *  }
 */
Did this help?

Yes

No
onFileUploaded( )
An event that triggers when a file has completed uploading.

The onFileUploaded() event handler runs when a file has been uploaded to to the Media Manager using the importFile(), upload() function, or the URL returned by the getUploadUrl() function.

The FileEvent object contains information about the uploaded file and the upload context.

Note: Backend events don't work when previewing your site.

Method Declaration
Copy
function onFileUploaded(event: FileEvent): void;
Method Parameters
event
FileEvent
Required
The uploaded file information.

Show Child Properties
Example shown:
An event when a file has been uploaded
JavaScript
// Place this code in the events.js file
// of your site's Backend section.

export function wixMediaManager_onFileUploaded(event) {
  let allFileInfo = event.fileInfo;
  let fileUrl = event.fileInfo.fileUrl;
  let mediaHeight = event.fileInfo.height;
}

/*  Full event object:
 *  {
 *    "fileInfo": {
 *      "mediaType": "image",
 *      "height": 300,
 *      "sourceUrl": "https://somedomain.com/img/original-name.jpg",
 *      "mimeType": "image/jpeg",
 *      "hash": "Ew00kXbu4Zt33rzjcWa6Ng==",
 *      "opStatus": "READY",
 *      "labels": [
 *        "Blue",
 *        "Butterfly",
 *        "Turquoise"
 *      ],
 *     "fileUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *     "originalFileName": "original-name.jpg",
 *     "sizeInBytes": 51085,
 *     "isPrivate": false,
 *     "width": 300,
 *     "iconUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *     "parentFolderId": "2bf470f5be194b319cdb2fvbu3278ff9"
 *    },
 *    context: {
 *      someKey1: "someValue1",
 *      someKey2: "someValue2"
 *    }
 *  }
 */
Did this help?

Yes

No
onVideoTranscoded( )
An event that triggers when a video file has completed transcoding.

The onVideoTranscoded() event handler runs when an uploaded video file has finished transcoding. Video files that have been imported aren't immediately available until the transcoding has completed.

It is fired after the onFileUploaded event, and after the transcoding has completed. The FileEvent object contains information about the uploaded video and the upload context.

Note: Backend events don't work when previewing your site.

Method Declaration
Copy
function onVideoTranscoded(event: FileEvent): void;
Method Parameters
event
FileEvent
Required
The uploaded file information.

Show Child Properties
Example shown:
An event when a video has been transcoded
JavaScript
// Place this code in the events.js file
// of your site's Backend section.

export function wixMediaManager_onVideoTranscoded(event) {
  let videoFileInfo = event.fileInfo;
  let fileUrl = event.fileInfo.fileUrl;
  let height = event.fileInfo.height;
}

/*  Full event object:
 *  {
 *     "fileInfo": {
 *        "mediaType": "video",
 *        "sourceUrl": "https://somedomain.com/img/original-name.mp4",
 *        "height": 480,
 *        "mimeType":"video/mp4",
 *        "hash":"c439e7b7a52f7d7d7263bc0c97dd1ab8",
 *        "fileUrl":"wix:video://v1/22d494_3d4b9f1c39674519bf636b9bef499659/fileName.mp4#posterUri=22d494_3d4b9f1c39674519bf636b9bef499659f002.jpg&posterWidth=480&posterHeight=480",
 *        "originalFileName":"fileName.mp4",
 *        "opStatus": "READY",
 *        "originalFileName": "original-name.mp4",
 *        "sizeInBytes":74424,
 *        "isPrivate":false,
 *        "width":480,
 *        "iconUrl":"wix:image://v1/22d494_3d4b9f1c39674519bf636b9bef499659f002.jpg/fileName.mp4#originWidth=480&originHeight=480"
 *        "parentFolderId":"09057cf95974494c83c8e0b93fd93909"}]"
 *     },
 *     "context": {
 *       "someKey1


 Introduction
To use the Media Manager API, import mediaManager from the wix-media-backend module:

Copy
import { mediaManager } from "wix-media-backend";
Did this help?

Yes

No
downloadFiles( )
Returns a download URL for downloading files from the Media Manager.

The downloadFiles() function returns a Promise that resolves to a download URL for the specified file(s) in the Media Manager.

A compressed file is created and can be downloaded using the download URL. The compressed file can contain up to 1000 files.

Call the wix-location.to() function with the returned download URL as the external web address. This opens the Download bar in your browser.

This function provides a permanent URL for downloading one or more files. To get a temporary download URL for a single file, use the getDownloadUrl() function.

Note: The downloadFiles() function only allows you to download files with supported media types, and files that are explicitly listed in the Media Manager. Files with unsupported media types such as 'model', and files that aren't explicitly listed in the Media Manager such as default files in a gallery component, can't be downloaded using the downloadFiles() function. The supported media types are listed in the description for the mediaType return in the getFileInfo() function.

Method Declaration
Copy
function downloadFiles(fileUrls: Array<string>): Promise<string>;
Method Parameters
fileUrls
Array<string>
Required
A list of URLs for the file(s) to download. You can get the URLs with the fileUrl property of the listFiles() function.

Returns
Return Type:
Promise<string>
Example shown:
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const myDownloadFilesFunction = webMethod(
  Permissions.Anyone,
  (fileUrls) => {
    return mediaManager
      .downloadFiles(fileUrls)
      .then((downloadUrl) => {
        return downloadUrl;
      })
      .catch((error) => {
        console.error(error);
      });
  },
);

/* Promise resolves to a URL similar to:
 * "https://archive.wixmp.com/archive/wix/4c492536c61a495ca4b4526d71439a64"
 */
Did this help?

Yes

No
downloadFolder( )
Returns a download URL for downloading a folder from the Media Manager.

The downloadFolder() function returns a Promise that resolves to a download URL for a Media Manager folder's files and sub-folders.

A compressed file is created and can be downloaded using the download URL. The compressed file can contain up to 1000 files. Sub-folders are included. The name of the top-level folder requested for download isn't included.

Call the wix-location.to() function with the returned download URL as the external web address. This opens the Download bar in your browser.

This function provides a permanent URL for downloading a folder. To get a temporary download URL for a single file, use the getDownloadUrl() function.

Method Declaration
Copy
function downloadFolder(folderId: string): Promise<string>;
Method Parameters
folderId
string
Required
The ID of the folder to download. You can get the ID with the folderId property of the listFolders() function.

Returns
Return Type:
Promise<string>
Example shown:
Get a download URL for a folder's contents
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

/* Sample folderId value:
 * '0abec0_bed6f8efb53348379b2011514254e954'
 */

export const myDownloadFolderFunction = webMethod(
  Permissions.Anyone,
  (folderId) => {
    return mediaManager
      .downloadFolder(folderId)
      .then((downloadUrl) => {
        return downloadUrl;
      })
      .catch((error) => {
        console.error(error);
      });
  },
);

/* Promise resolves to a download URL similar to:
 * 'https://archive.wixmp.com/archive/wix/2d8d9ffc016c443387e42abf8e459c66'
 */
Did this help?

Yes

No
getDownloadUrl( )
Gets a temporary download URL with a token for a specified file in the Media Manager.

The getDownloadUrl() function returns a Promise that resolves to a download URL for a specified file in the Media Manager.

Pass the file's URL in the fileUrl parameter, as returned in the fileUrl property of the getFileInfo(), importFile(), upload(), and listFiles() functions. When the download URL is clicked, the specified file downloads to your device.

You can use the getDownloadUrl() function to allow external clients to download a file from the Media Manager to their device.

This function provides a temporary URL for downloading a single file. If you need permanent download URLs for one or more files, use the downloadFiles() function.

Notes:

The download URL with the token is valid for a single file download only. getDownloadUrl() must be called for each file that you want to download.
This function's parameters are positional, and must be specified in the sequence shown in the syntax below. When specifying a parameter, use null as a placeholder for any unspecified parameters. For example, to specify downloadedFileName only, call getDownloadUrl(fileUrl, null, downloadedFileName, null).
Method Declaration
Copy
function getDownloadUrl(
  fileUrl: string,
  expirationTime: number,
  downloadedFileName: string,
  expiredTokenRedirectUrl: string,
): Promise<string>;
Method Parameters
fileUrl
string
Required
The file's Wix media URL in the following format: 'wix:image://v1//#originWidth=&originHeight=[&watermark=]'.

expirationTime
number
The time (in minutes) it takes for the download URL to expire. Defaults to 600. Limit is 525600 (1 year).

downloadedFileName
string
The downloaded file's name. Defaults to the file's name displayed in the Media Manager.

expiredTokenRedirectUrl
string
The redirect URL for when the download URL with a token has expired. Defaults to a 403 Forbidden response page.

Returns
Return Type:
Promise<string>
Example shown:
When clicked, the URL downloads a file from the Media Manager to your device.

JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

// Sample fileUrl value: 'wix:image://v1/0abec0_51b1141c839c4d349035941cb9427ebe~mv2.jpg/child-on-bike.jpg#originWidth=768&originHeight=1024'

export const myGetDownloadUrlFunction = webMethod(
  Permissions.Anyone,
  async (fileUrl) => {
    const myFileDownloadUrl = await mediaManager.getDownloadUrl(fileUrl);
    return myFileDownloadUrl;
  },
);

/* Promise resolves to:
 * "https://download-files.wix.com/_api/download/file?downloadToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiO..."
 */
Did this help?

Yes

No
getFileInfo( )
Gets a file's information from the Media Manager by fileUrl.

The getFileInfo() function returns a Promise that resolves to information about the specified file.

Method Declaration
Copy
function getFileInfo(fileUrl: string): Promise<FileInfo>;
Method Parameters
fileUrl
string
Required
The file's Wix media URL in the following format: 'wix:image://v1//#originWidth=&originHeight=[&watermark=]'.

Note: This replaces the old fileName parameter. fileName will continue to work, but we recommend that you use the updated fileUrl parameter instead.

Returns
Return Type:
Promise<FileInfo>
Show FileInfo Properties
Example shown:
Get a file's information
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const getFileInfo = webMethod(Permissions.Anyone, async (fileUrl) => {
  return mediaManager.getFileInfo(fileUrl);
});

/* Returns a promise that resolves to:
 * {
 *   "fileUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *   "hash": "Ew00kXbu4Zt33rzjcWa6Ng==",
 *   "sizeInBytes": 51085,
 *   "mimeType": "image/jpeg",
 *   "mediaType": "image",
 *   "isPrivate": false,
 *   "iconUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *   "parentFolderId": "2bf470f5be194b319cdb2accc3278ff9",
 *   "originalFileName": "original-name.jpg",
 *   "sourceUrl": "https://somedomain.com/img/original-name.jpg",
 *   "width": 300,
 *   "height": 300,
 *   "labels": [
 *     "Blue",
 *     "Butterfly",
 *     "Turquoise"
 *   ],
 *   "opStatus": "READY"
 * }
 */
Did this help?

Yes

No
getFileUrl( )
Deprecated. This function will continue to work, but a newer version is available. Use the getDownloadUrl function instead.

Note: The new getDownloadUrl function contains additional parameters.

Gets a temporary download URL with a token from the Media Manager for a specified file.

The getFileUrl() function returns a Promise that resolves to a download URL for the specified file.

Pass a Media Manager file URL in the fileUrl parameter, as returned in the fileUrl property from the getFileInfo(), importFile(), and upload() functions.

Method Declaration
Copy
function getFileUrl(fileUrl: string): Promise<string>;
Method Parameters
fileUrl
string
Required
The file's Wix media URL in the following format: 'wix:image://v1//#originWidth=&originHeight=[&watermark=]'.

Note: This replaces the old fileName parameter. fileName will continue to work, but we recommend that you use the updated fileUrl parameter instead.

Returns
Return Type:
Promise<string>
Example shown:
Get a file's URL
This example uses a deprecated function.

JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const getFileUrl = webMethod(Permissions.Anyone, async (fileUrl) => {
  return mediaManager.getFileUrl(fileUrl);
});

/* Returns a promise that resolves to:
 * https://download-files.wix.com/_api/download/file?downloadToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiO...
 */
Did this help?

Yes

No
getFolderInfo( )
Gets a folder's information from the Media Manager by folderId.

The getFolderInfo() function returns a Promise that resolves to information about the specified folder.

The folderId property is the internal name (unique identifier) which is generated when a folder is created by the Media Manager.

Method Declaration
Copy
function getFolderInfo(folderId: string): Promise<FolderInfo>;
Method Parameters
folderId
string
Required
Internal name (unique identifier) which is generated when a folder is created by the Media Manager.

Returns
Return Type:
Promise<FolderInfo>
Show FolderInfo Properties
Example shown:
Get a folder's information
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

const folderId = "1bf317e889264736b5acb367415fad8e";

export const myGetFolderInfoFunction = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const myFolder = await mediaManager.getFolderInfo(folderId);
      const folderName = myFolder.folderName;
      const updatedDate = myFolder._updatedDate;
      return myFolder;
    } catch (error) {
      console.error(error);
    }
  },
);

/* Returns a promise that resolves to:
 * {
 *   "folderId": "1bf317e889264736b5acb367415fad8e",
 *   "folderName": "greatfolder1",
 *   "parentFolderId": "media-root",
 *   "_createdDate": "Sun December 4 2020 14:56:15 GMT+0300",
 *   "_updatedDate": "Wed May 12 2021 14:56:15 GMT+0300"
 * }
 */
Did this help?

Yes

No
getUploadUrl( )
Gets an upload URL for uploading a file to the media manager.

The getUploadUrl() function returns a Promise that resolves to an object containing an upload URL.

Use the getUploadUrl() function to allow an external client to upload a single file to your site's Media Manager.

Note: The upload URL is valid for a single file upload and expires after 1 day. The getUploadUrl() function must be called for each file that you want to upload.

The external client uploads a file by sending a POST or PUT request to the URL returned by getUploadUrl() using multipart/form-data encoding and sending the following data:

Copy
{
  "upload_url": ,
  "file": {
    "value": ,
    "options": {
      "filename": ,
      "contentType": 
    }
  }
};
upload_url: The returned upload URL.

file: An object containing:

value: The file content as a multi-part value.

options: An object containing:

filename: The name of the file as it will appear in the Media Manager.
contentType: The content type of the file.
The POST or PUT request returns the following:

Copy
[ 
  { 
    "parent_folder_id": ,
    "hash": ,
    "tags": [],
    "file_name": ,
    "refs": [],
    "labels": [] ,
    "site_id": ,
    "height": ,
    "original_file_name": ,
    "file_size": ,
    "width": ,
    "media_type": "picture",
    "mime_type": "image/jpeg"
  } 
]
To get a Wix image URL that can be stored in a collection or displayed in an image element or gallery from the above object, use the following expression:

Copy
let wixImageUrl = `wix:image://v1/${response[0].file_name}/${response[0].original_file_name}#originWidth=${response[0].width}&originHeight=${response[0].height}`;
Method Declaration
Copy
function getUploadUrl(path: string, options: UploadOptions): Promise<UploadUrl>;
Method Parameters
path
string
Required
The path within the Media Manager where the file will be uploaded. If the path doesn't yet exist, the missing folders will be created.

options
UploadOptions
Required
Options to use when uploading the file.

Show Child Properties
Returns
Return Type:
Promise<UploadUrl>
Show UploadUrl Properties
Example shown:
This example demonstrates how to generate a URL that an external application can use to upload a file to your site's Media Manager.

JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const getUploadUrl = webMethod(Permissions.Anyone, () => {
  return mediaManager.getUploadUrl("/myUploadFolder/subfolder", {
    mediaOptions: {
      mimeType: "image/jpeg",
      mediaType: "image",
    },
    metadataOptions: {
      isPrivate: false,
      isVisitorUpload: false,
      context: {
        someKey1: "someValue1",
        someKey2: "someValue2",
      },
    },
  });
});
Did this help?

Yes

No
getVideoPlaybackUrl( )
Gets a video file's playback URL from the Media Manager.

The getVideoPlaybackUrl() function returns a Promise that resolves to the specified video file's playback URL.

Method Declaration
Copy
function getVideoPlaybackUrl(fileUrl: string, format: string): Promise<string>;
Method Parameters
fileUrl
string
Required
The file's Wix media URL in the following format: 'wix:image://v1//#originWidth=&originHeight=[&watermark=]'.

Note: This replaces the old fileName parameter. fileName will continue to work, but we recommend that you use the updated fileUrl parameter instead.

format
string
Required
The format of the URL to get. Either "hls" or "dash".

Returns
Return Type:
Promise<string>
Example shown:
Get a URL to be used for video playback
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const getVideoPlaybackUrl = webMethod(
  Permissions.Anyone,
  async (fileUrl) => {
    return mediaManager.getVideoPlaybackUrl(fileUrl, "hls");
  },
);

/* Returns a promise that resolves to:
 * "https://repackager.wixmp.com/video.wixstatic.com/video/f6c0f9..."
 */
Did this help?

Yes

No
importFile( )
Imports a file to the Media Manager from a URL.

The importFile() function returns a Promise that resolves to information about the newly imported file.

Video and audio files that have been imported aren't immediately available to be used even after the Promise is resolved. Before they can be used, they must first undergo transcoding. The onFileUploaded() event is triggered when an imported file has been uploaded and before the transcoding is finished. As a result, some properties such as the fileUrl may not initially appear in the returns.

Note: Receiving a response does not indicate that the import is complete. To run code when the import finishes, implement the relevant event. See Importing and Uploading Files to learn more.

Method Declaration
Copy
function importFile(
  path: string,
  url: string,
  options: UploadOptions,
): Promise<FileInfo>;
Method Parameters
path
string
Required
The path within the Media Manager where the file will be uploaded. If the path doesn't yet exist, the missing folders will be created, for example: /media/files.

If metadataOptions.isVisitorUpload is true (default), the visitor-uploads folder is the root of the file path, in this case, visitor-uploads/media/files/.

url
string
Required
The file's external URL, where it was imported from.

options
UploadOptions
Required
Options to use when uploading a file

Show Child Properties
Returns
Return Type:
Promise<FileInfo>
Show FileInfo Properties
Example shown:
Import a file
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const importFile = webMethod(Permissions.Anyone, (url) => {
  return mediaManager.importFile("/myImportFolder/subfolder", url, {
    mediaOptions: {
      mimeType: "image/jpeg",
      mediaType: "image",
    },
    metadataOptions: {
      isPrivate: false,
      isVisitorUpload: false,
      context: {
        someKey1: "someValue1",
        someKey2: "someValue2",
      },
    },
  });
});

/* Returns a promise that resolves to:
 *
 * {
 *   "fileUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/imported-pic.png#originWidth=319&originHeight=206",
 *   "hash": "Ew00kXbu4Zt33rzjcWa6Ng==",
 *   "sizeInBytes": 51085,
 *   "mimeType": "image/jpeg",
 *   "mediaType": "image",
 *   "isPrivate": false,
 *   "parentFolderId": "2bf470f5be194b319cdb2accc3278ff9",
 *   "originalFileName": "my-image.jpg",
 *   "sourceUrl": "https://somedomain.com/img/original-name.jpg",
 *   "opStatus": "IN-DOWNLOAD-QUEUE"
 * }
 */
Did this help?

Yes

No
listFiles( )
Gets a list of files from the Media Manager by parentFolderId (or root).

The listFiles() function returns a Promise that resolves to information about the files in the folder.

To get a list of files within a specific folder in the Media Manager, pass the folder's ID in the parentFolderId parameter. If no folder is specified, the listFiles() function returns the list of files in the root folder of the Media Manager.

Notes:

This function's parameters are positional, and must be specified in the sequence shown in the syntax below. When specifying a parameter, use null as a placeholder for any unspecified parameters. For example, to specify parentFolderId only, call listFiles(filters, null, null). For example, to specify sorting only, call listFiles(null, sorting, null).

The listFiles() function only gets a list of files with supported media types, and that are explicitly listed in the Media Manager. Files with unsupported media types such as 'model', and files that aren't explicitly listed in the Media Manager such as default files in a gallery component, aren't listed when calling the listFiles() function. The supported media types are listed in the description for the mediaType return in the getFileInfo() function.

Method Declaration
Copy
function listFiles(
  filters: FileFilterOptions,
  sorting: SortingOptions,
  paging: PagingOptions,
): Promise<Array<File>>;
Method Parameters
filters
FileFilterOptions
File filter options.

Show Child Properties
sorting
SortingOptions
Sorting options.

Show Child Properties
paging
PagingOptions
Paging options.

Show Child Properties
Returns
Return Type:
Promise<Array<File>>
Show File Properties
Example shown:
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

const filters = {
  parentFolderId: "8a3be85ea03e4b8b82f2f9c989557c3d",
};

export const myListFilesFunction = webMethod(Permissions.Anyone, () => {
  return mediaManager
    .listFiles(filters, null, null)
    .then((myFiles) => {
      const originalFileName = myFiles[0].originalFileName;
      const fileUrl = myFiles[1].fileUrl;
      return myFiles;
    })
    .catch((error) => {
      console.error(error);
    });
});

/* Returns a promise that resolves to:
 * [{
 *   "fileUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *   "hash": "Ew00kXbu4Zt33rzjcWa6Ng==",
 *   "sizeInBytes": 51085,
 *   "mimeType": "image/jpeg",
 *   "mediaType": "image",
 *   "isPrivate": false,
 *   "iconUrl": "wix:image://v1/f6c0f9_tg439f4475a749e181dd14407fdbd37e~mv2.jpg/original-name.jpg#originWidth=300&originHeight=300",
 *   "parentFolderId": "8a3be85ea03e4b8b82f2f9c989557c3d",
 *   "originalFileName": "original-name1.jpg",
 *   "width": 300,
 *   "height": 300,
 *   "labels": [
 *     "Blue",
 *     "Butterfly",
 *     "Turquoise"
 *   ],
 *   "_createdDate": "Sun December 4 2020 10:56:09 GMT+0300",
 *   "_updatedDate": "Wed May 12 2021 14:27:15 GMT+0300"
 * },
 * {
 *   "fileUrl": "wix:image://v1/8b7eef_47332c4ae5b74db89d86d5d9e0cd303b~mv2.png/Screen%20Shot%202021-05-19%20at%209.59.29.png#originWidth=984&originHeight=1230",
 *   "hash": "93fea6d1c6f7b10e24a729b0402ac152",
 *   "sizeInBytes": 232794,
 *   "mimeType": "image/jpeg",
 *   "mediaType": "image",
 *   "isPrivate": false,
 *   "iconUrl": "wix:image://v1/8b7eef_47332c4ae5b74db89d86d5d9e0cd303b~mv2.png/Screen%20Shot%202021-05-19%20at%209.59.29.png#originWidth=984&originHeight=1230",
 *   "parentFolderId": "8a3be85ea03e4b8b82f2f9c989557c3d",
 *   "originalFileName": "original-name2.jpg",
 *   "sourceUrl": "https://somedomain.com/img/original-name.jpg",
 *   "width": 984,
 *   "height": 221,
 *   "labels": [
 *     "Font",
 *     "Type",
 *     "Write"
 *   ],
 *   "opStatus": "READY",
 *   "_createdDate": "Tues January 22 2020 12:56:02 GMT+0300",
 *   "_updatedDate": "Fri October 9 2020 04:56:22 GMT+0300"
 * }]
 */
Did this help?

Yes

No
listFolders( )
Gets a list of folders from the Media Manager by parentFolderId (or root).

The listFolders() function returns a Promise that resolves to information about the folders in the folder.

To get a list of folders within a specific folder in the Media Manager, pass the folder's ID in the parentFolderId parameter. If no folder is specified, the listFolders() function returns the list of folders in the root folder of the Media Manager.

Note: This function's parameters are positional, and must be specified in the sequence shown in the syntax below. When specifying a parameter, use null as a placeholder for any unspecified parameters. For example, to specify parentFolderId only, call listFolders(filters, null, null). For example, to specify sorting only, call listFolders(null, sorting, null).

Method Declaration
Copy
function listFolders(
  filters: FolderFilterOptions,
  sorting: SortingOptions,
  paging: PagingOptions,
): Promise<Array<FolderInfo>>;
Method Parameters
filters
FolderFilterOptions
Folder filter options.

Show Child Properties
sorting
SortingOptions
Sorting options.

Show Child Properties
paging
PagingOptions
Paging options.

Show Child Properties
Returns
Return Type:
Promise<Array<FolderInfo>>
Show FolderInfo Properties
Example shown:
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

const filters = {
  parentFolderId: "8a3be85ea03e4b8b82f2f9c989557c3d",
};

export const myListFoldersFunction = webMethod(Permissions.Anyone, () => {
  return mediaManager
    .listFolders(filters, null, null)
    .then((myFolders) => {
      const folderName = myFolders[0].folderName;
      const updatedDate = myFolders[1]._updatedDate;
      return myFolders;
    })
    .catch((error) => {
      console.error(error);
    });
});

/* Returns a promise that resolves to:
 * [{
 *   "folderId": "1bf317e889264736b5acb367415fad8e",
 *   "folderName": "greatfolder1",
 *   "parentFolderId": "8a3be85ea03e4b8b82f2f9c989557c3d",
 *   "_createdDate": "Sun December 4 2020 14:56:15 GMT+0300",
 *   "_updatedDate": "Wed May 12 2021 14:56:15 GMT+0300"
 * },
 * {
 *   "folderId": "2fj678p889264736b5acb367415fad5g",
 *   "folderName": "greatfolder2",
 *   "parentFolderId": "8a3be85ea03e4b8b82f2f9c989557c3d",
 *   "_createdDate": "Sun December 4 2020 14:56:15 GMT+0300",
 *   "_updatedDate": "Wed May 12 2021 14:56:15 GMT+0300"
 * }]
 */
Did this help?

Yes

No
moveFilesToTrash( )
Moves single or multiple files to the Media Manager's trash.

The moveFilesToTrash() function returns a Promise that resolves when the file(s) are moved to the Media Manager's trash.

Moving many files to trash at once is an asynchronous action. It may take some time for the results to be seen in the Media Manager.

Use the Media Manager to restore or permanently delete the trashed files.

Attempting to move already-trashed files to trash again doesn't result in an error.

Method Declaration
Copy
function moveFilesToTrash(fileUrls: Array<string>): Promise<void>;
Method Parameters
fileUrls
Array<string>
Required
URLs of the files to move to trash.

Example shown:
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

/* Sample fileUrls array:
 * [
 *   "wix:image://v1/4c47c6_85e8701ae75d4bb48436aecbd28dda5a~mv2.png/cat8.png#originWidth=337&originHeight=216",
 *   "wix:image://v1/4c47c6_49b0e6d2c19b4564a191f88f6748bbb3~mv2.png/cat9.png#originWidth=319&originHeight=206"
 * ]
 */

export const myMoveFilesToTrashFunction = webMethod(
  Permissions.Anyone,
  (fileUrls) => {
    return mediaManager
      .moveFilesToTrash(fileUrls)
      .then(() => {
        console.log("Success! Files have been trashed.");
      })
      .catch((error) => {
        console.error(error);
      });
  },
);

/**
 * Returns a promise that resolves to <void>
 **/
Did this help?

Yes

No
moveFoldersToTrash( )
Moves single or multiple folders, including their files and sub-folders, to the Media Manager's trash.

The moveFoldersToTrash() function returns a Promise that resolves when the folder(s) are moved to the Media Manager's trash.

Moving many folders to trash at once is an asynchronous action. It may take some time for the results to be seen in the Media Manager.

Use the Media Manager to restore or permanently delete trashed folders.

Attempting to move already-trashed folders to trash again doesn't result in an error.

Method Declaration
Copy
function moveFoldersToTrash(folderIds: Array<string>): Promise<void>;
Method Parameters
folderIds
Array<string>
Required
IDs of the folders to move to trash.

Example shown:
Move a single folder to trash
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

/* Sample folderIds array:
 * [
 *   'de4e7c3258f444e9a506a8572d951ddf',
 *   'a2597566072c463492f9963c377f3f74'
 * ]
 */

export const myMoveFoldersToTrashFunction = webMethod(
  Permissions.Anyone,
  (folderIds) => {
    return mediaManager
      .moveFoldersToTrash(folderIds)
      .then(() => {
        console.log("Success! Folders have been trashed.");
      })
      .catch((error) => {
        console.error(error);
      });
  },
);

/**
 * Returns a promise that resolves to <void>
 **/
Did this help?

Yes

No
upload( )
Uploads a file to the Media Manager from a buffer.

The upload() function returns a Promise that resolves to information about the newly uploaded file.

Video and audio files that have been uploaded aren't immediately available to be used even after the Promise is resolved. Before they can be used, they must first undergo transcoding. The onFileUploaded() event is triggered when a file has been uploaded and before the transcoding is finished.

To import a file to the Media Manager directly from a URL, use the importFile() function.

To enable site visitors to upload files to your site, you can also use an upload button.

Notes:

There are limits on the size and duration of files that you can upload. See Wix Media: Supported Media File Types and File Sizes for more details.
Receiving a response does not indicate that the import is complete. To run code when the upload finishes, implement the relevant event. See Importing and Uploading Files to learn more.
Method Declaration
Copy
function upload(
  path: string,
  fileContent: Buffer,
  fileName: string,
  options: UploadOptions,
): Promise<FileInfo>;
Method Parameters
path
string
Required
The path within the Media Manager where the file will be uploaded.

If the path doesn't yet exist, the missing folders will be created, for example: /media/files.

If metadataOptions.isVisitorUpload is true (default), the visitor-uploads folder is the root of the file path, in this case, visitor-uploads/media/files/.

fileContent
Buffer
Required
Buffer containing the content to be uploaded.

fileName
string
Required
In this case the fileName is the name you would like your file to appear as in the Media Manager.

options
UploadOptions
Required
Options to use when uploading the file.

Show Child Properties
Returns
Return Type:
Promise<FileInfo>
Show FileInfo Properties
Example shown:
Upload a file
JavaScript
import { Permissions, webMethod } from "wix-web-module";
import { mediaManager } from "wix-media-backend";

export const uploadImage = webMethod(Permissions.Anyone, (buffer) => {
  return mediaManager.upload(
    "/myUploadFolder/subfolder",
    buffer,
    "myFileName.jpg",
    {
      mediaOptions: {
        mimeType: "image/jpeg",
        mediaType: "image",
      },
      metadataOptions: {
        isPrivate: false,
        isVisitorUpload: false,
        context: {
          someKey1: "someValue1",
          someKey2: "someValue2",
        },
      },
    },
  );
});

/*  Returns a promise that resolves to:
 *  {
 *    "mediaType": "image",
 *    "isPrivate": false,
 *    "sizeInBytes": 51085,
 *    "mimeType": "image/jpeg",
 *    "iconUrl": "wix:image://v1/f6c0f9_g2ae28cf29ec4639bc45698fee57cf56~mv2.jpg/myFileName.jpg#originWidth=300&originHeight=300",
 *    "fileUrl": "wix:image://v1/f6c0f9_g2ae28cf29ec4639bc45698fee57cf56~mv2.jpg/myFileName.jpg#originWidth=300&originHeight=300",
 *    "originalFileName": "myFileName.jpg",
 *    "hash": "bee2f8aab80b0d011499361c2eb189eb",
 *    "labels": [
 *      "Blue",
 *      "Butterfly",
 *      "Turquoise"
 *    ],
 *    "width": 300,
 *    "height": 300
 * }
 */