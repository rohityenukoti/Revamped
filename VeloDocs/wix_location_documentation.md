Introduction
To use the location module, import wixLocationFrontend from the wix-location-frontend module:

Copy
import wixLocationFrontend from "wix-location-frontend";
The setter functions in wix-location-frontend can only be used when browser rendering happens, meaning you can only use them in frontend code after the page is ready. You can use the getter functions for both server-side or browser rendering.

The URL is broken into:

baseUrl
prefix, for routers and dynamic pages only.
path
query
Premium Sites
For premium sites, the URL of the incoming call has the following format: https://www.domain.com/myPrefix/myPath?myQuery=myValue

baseUrl:     https://www.domain.com
prefix:        myPrefix
path:          myPath
query:        myQuery=myValue
Example: https://domain.com/animals/elephant?species=african-elephant

baseUrl:     https://domain.com/
prefix:        animals. Only for routers and dynamic pages.
path:          elephant
query:        species=african-elephant
Free Sites
For free sites, the URL of the incoming call has the following format: https://user_name.wixsite.com/mysite/myPrefix/myPath?myQuery=myValue

baseUrl:     https://user_name.wixsite.com/mysite
prefix:        myPrefix
path:          myPath
query:        myQuery=myValue
Example: https://user_name.wixsite.com/zoo/animals/elephant?species=african-elephant

baseUrl:     https://user.wixsite.com/zoo
prefix:        animals. Only for routers and dynamic pages.
path:          elephant
query:        species=african-elephant
Learn more about wix-location-frontend in Getting Started and on Wix Learn.

Was this helpful?
Yes
No
baseUrl
baseUrl
string
Read-only
Gets the base URL of the current page.

Premium sites: Premium site baseUrl

Free sites: Free site baseUrl

Was this helpful?
Yes
No
Example shown:
Get the base URL of the current page
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// Premium site URL: "https://www.domain.com/elephant?species=african-elephant"
// Free site URL: "https://user_name.wixsite.com/zoo/elephant?species=african-elephant"

let baseUrl = wixLocationFrontend.baseUrl;
// Premium site: "https://domain.com/"
// Free site: "https://user_name.wixsite.com/zoo/"
path
path
Array<string>
Read-only
Gets the path of the current page's URL.

The path for a regular page is after the baseUrl If the page is a dynamic page or router page, the prefix appears after the base URL, before the path.

Premium sites:
Path for a regular page, without a prefix: Premium site path
Path for a dynamic or router page with a prefix: Premium site path with a prefix

Free sites:
Path for a regular page, without a prefix: Free site path
Path for a dynamic or router page with a prefix: Free site path

Was this helpful?
Yes
No
Example shown:
Get the path of the current page's URL
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// Premium site URL: "https://www.domain.com/elephant?species=african-elephant#desc"
// Free site URL: "https://user_name.wixsite.com/zoo/elephant?species=african-elephant#desc"

let path = wixLocationFrontend.path; // ["elephant"]
prefix
prefix
string
Read-only
Gets the prefix of a dynamic page's or router page's URL.

Only dynamic pages and router pages have a prefix. The value of the prefix property for other page types is always undefined.

Premium sites: Premium site prefix

Free sites: Free site prefix

To learn more about dynamic page prefixes, see About URL Prefixes and Page Grouping of Dynamic Pages.

To learn more about router page prefixes, see About Routers.

Was this helpful?
Yes
No
Example shown:
Get the prefix of the current page's URL
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// Premium site URL: "https://www.domain.com/mammals/elephant?species=african-elephant#desc"
// Free site URL: "https://user_name.wixsite.com/zoo/mammals/elephant?species=african-elephant#desc"

let prefix = wixLocationFrontend.prefix; // "mammals"
protocol
protocol
string
Read-only
Gets the protocol of the current page's URL.

Premium sites: Premium site protocol

Free sites: Free site protocol

Was this helpful?
Yes
No
Example shown:
Get the protocol of the current page's URL
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// Premium site URL: "https://www.domain.com/animals/elephant?species=african-elephant#desc"
// Free site URL: "https://user_name.wixsite.com/zoo/animals/elephant?species=african-elephant#desc"

let protocol = wixLocationFrontend.protocol; // "https"
query
query
object
Read-only
Gets an object that represents the query segment of the current page's URL.

Premium sites: Premium site query

Free sites: Free site query

Was this helpful?
Yes
No
Example shown:
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// Premium site URL: "https://www.domain.com/animals/elephant?species=african-elephant#desc"
// Free site URL: "https://user_name.wixsite.com/zoo/animals/elephant?species=african-elephant#desc"

let query = wixLocationFrontend.query; // {"species": "african-elephant"}
queryParams
Was this helpful?
Yes
No
Example shown:
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// ...

wixLocationFrontend.queryParams.add({
  key2: "value2new",
  key3: "value3",
});

// URL before addition:
// www.mysite.com/page?key1=value1&key2=value2

// URL will look like:
// www.mysite.com/page?key1=value1&key2=value2new&key3=value3
url
url
string
Read-only
Gets the full URL of the current page.

Premium sites: Premium site URL

Free sites: Free site URL

Was this helpful?
Yes
No
Example shown:
Get the full URL of the current page
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// ...

let url = wixLocationFrontend.url;
// Premium site: "https://www.domain.com/animals/elephant?species=african-elephant#desc"
// Free site: "https://user_name.wixsite.com/zoo/animals/elephant?species=african-elephant#desc"
onChange( )
Adds an event handler that runs when an application page's URL changes.

The event handler set by the onChange() function runs when the location is changed but the change doesn't trigger navigation. This situation occurs when navigating between subitems on a page that is managed by a full-page application.

For example, a store product page is a full-page application. When a product page's path changes because it is switching between items, no actual navigation is taking place. You can use the onChange() event handler to determine when a new product is displayed and perform any necessary partial updates on the current page.

The onChange() function can only be used when browser rendering happens, meaning you can only use it in frontend code after the page is ready.

To determine if a page is managed by a full-page application, use the wix-site-frontend currentPage property or getSiteStructure() function to retrieve a StructurePage object that corresponds to the page. If the object contains an applicationId value, then the page is managed by a full-page application.

Method Declaration
Copy
function onChange(handler: function): void;
Method Parameters
handler
function
Required
handler(event: Location): void The name of the function or the function expression to run when the location changes.

Show function Parameters
Example shown:
Get the new location path
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// ...

wixLocationFrontend.onChange((location) => {
  let newPath = location.path;
});
Was this helpful?
Yes
No
to( )
Directs the browser to navigate to the specified URL.

The to() function navigates the browser to another web page.

The to() function can only be used when browser rendering happens, meaning you can only use it in frontend code after the page is ready.

The following link patterns are supported:

/localPageURL: Another page on your site.
/localPageURL#: Another page on your site scrolled to the element with the specified ID. The element must be an element that supports the scrollTo function.
/localPageURL?queryParam=value: Another page on your site with query parameters.
/: Your site's home page.
http(s)://: An external web address.
wix:document://: A document stored in the Media Manager.
mailto:@?subject=: An email.
tel:: A phone number.
To find the local URL of a page on your site in the Editor:

Regular page: See the SEO tab of the Page Settings panel.

Dynamic page: See the Page Info tab of the Page Settings panel for the URL structure. The actual URL used for navigation needs to contain values where the placeholders are.

For example, if the URL structure of your dynamic page looks like:

Dynamic Page URL

and you have an item with the title "Waffles", the local URL to that page is /Recipes/Waffles.

Router page: You cannot navigate directly to a specific router page. You can navigate to a URL with the router's prefix and the router code decides which page to route to.

By default, when navigating to a new URL for a Wix page, the page scrolls to the top. Set the disableScrollToTop navigation parameter property to true if you want the page to remain at the current Y-axis position as the previously-viewed page.

The to() function attempts to properly encode the URL parameter that is passed to it. For example, .../some page is encoded to .../some%20page. However, some URLs do not have one unambiguous encoding. In those cases it is up to you to encode the URL to reflect your intentions. Because of these situations, it is a best practice to always encode URLs before you pass them to the to() function.

Note that Wix URLs do not contain spaces. A page which has spaces in its name has its spaces replaced with dashes (-). Similarly, a dynamic page whose URL contains the value of a field in your collection with spaces has its spaces replaced with dashes (-).

Note: The to() function does not work while previewing your site.

Method Declaration
Copy
function to(url: string, options: NavOptions): void;
Method Parameters
url
string
Required
The URL of the page or website to navigate to.

options
NavOptions
Options to use when navigating to the specified URL, such as scrolling options.

Show Child Properties
Example shown:
JavaScript
import wixLocationFrontend from "wix-location-frontend";

// ...

wixLocationFrontend.to("/about-me");