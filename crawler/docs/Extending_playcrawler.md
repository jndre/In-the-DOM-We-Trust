# Extending Playcrawler
This tutorial is mainly aimed towards new colleagues or students who want to do some crawling and do not reinvent the wheel.
It aims to showcase how you can extend Playcrawler to run your own analysis.

The example usecase for this tutorial is an analysis where we want to store the full HTML code of a loaded page, as well as all metadata provided by this page in form of meta tags.
To do this, we have to quickly over the general structure of the Playcrawler first.

## General Structure

The idea of Playcrawler is to promote modularity. That is, to add your own analysis you should not have to change any of the program's code. Doing so without appropriate communication with the maintainers will lead to rejection of your PR/revert of your changes, should they end up in the master branch.
If you however find a bug in the core components, feel free to open an issue and a PR if you have 
an idea on how to fix it.

Consequently, the goal is to implement new a analysis in the form of a module. To be incorporated into the crawling process, a module can export a range of functions which are called by the core crawling component.

As shown in the main Readme, to run a crawl you have to invoke Playcrawler as follows:

1. Setup: `node main.js --module=cookies,default --task=seed`
2. Crawling: `node main.js --module=cookies,default --task=crawl`

Here we see that 2 modules are loaded for this crawl, i.e., [cookies](../modules/cookies.js) and [default](../modules/cookies.js), with two tasks.
The tasks select whether the crawl shall be prepared (the task called `seed`), that is to initialize the database and load the pages to visit into the database or whether to actually run the crawl, with the task of the same name.

If you have a look into the [default](../modules/default.js) module, you will find that it exports 5 functions (`initialize`, `seed`, `before`, `during`, `after`) and 1 property (`options`). These are the hooks available for modules and when writing your own analysis, it should go into a module and define the functions required for the task at hand.

Generally, these exported functions and properties are used as follows:
- `options`: Allows to set various options, e.g., to pass to the browser instance upon creation. See [here](https://playwright.dev/docs/api/class-browsertype#browser-type-launch) for available options or have a look into the existing modules. It also allows to pass options to the browser context, see [here](https://playwright.dev/docs/api/class-browser#browser-new-context) for available options. If this is confusing to you, I suggest to use Playwright directly to test how to set the options you desire and then search for the appropriate configuration point in Playcrawler.

- `seed`: Called when the seed task of a module is executed. This is used for two main aspects:
    1. To load the domain list you want to visit and setting general parameters, such as crawling depth. 
    2. To create database tables required for your analysis. All tables required for your analysis should be defined here and everything you want to store should go into these tables. Modules which change values in the tables of the core components will not be accepted in the main repository without appropriate communication with the maintainers beforehand.

- `initialize`: When a new browser context is created, `initialize` will be called. This occurs during startup, but also periodically during the crawling run, to reset the browser to a clean state, i.e., terminate stray windows and stuff. This hook can be used to setup aspects applicable to the whole context, e.g., request interception, adding init scripts (JavaScript files injected into every page) or exposing bindings to all pages. For an example using all these aspects, see [the cookies module](../modules/cookies.js).

- `before`: Is called before Playcrawler visits a URL. This can be used to reset stored data or to set cookies for a page.

- `during`: Called after the page has loaded. This hook is usually used to interact with the page, i.e., to extract some values or check for some properties. It is advised to call `await common.sleep(5000);` at the beginning of this hook (5s might be too long, depends on your analysis and connectivity) to ensure dynamic features of the page have fully loaded.

- `after`: Called after the page was closed, consequently can be used to store post-process saved data and to store it in the database.

## Putting it into practice

So, coming back to using the crawling infrastructure to actually perform some crawling task. The idea is to store the HTML code of a website after all the JavaScript rubbish has executed. Additionally, we want store all meta tags.

### Setup

Prior to crawling we have to set up the parameters and database structure for our experiment. To do so we create a module called [tutorial.js](../modules/tutorial.js) containing an exported `seed` function and a `options` object.

As explained before, this function has two tasks: Importing the URL list and setting the parameters and setting up the database.

The first task can be done as follows:
To set the parameters (crawling depth etc) we set attributes of the crawler property of the options object. E.g., the following `options` object could be used for this experiment:

```javascript
const options = {
    browser: {},
    context: {},
    crawler: {maxDepth: 1, maxLinks: 10, randomizeLinks: true, maxRetries: 2},
};
```
Here we do not change any browser or context related settings, but set how deep the crawl should traverse the page, how many links to visit, whether the extracted links shall be shuffled prior to taking the first `10` links and how many times we want to attempt to revisit pages where a HTTP error occurred. The last option is helpful to avoid losing a large portion of the dataset due to spurious network errors, which are sadly fairly frequent with asian websites.

Afterwards we have to write the `seed` method. This method should always initially call the general seed function to ensure everything is in order and then, if this is your main module, import a URL list. The latter point is somewhat important and depends on how your experiment is composed. For example, the [tainting](../modules/tainting.js) module is always used together with a different module, i.e., it adds the capability to store taint flows to a different module. Consequently, the tainting module does not import a URL list, while for example the [cookies](../modules/cookies.js) does. This means the cookies module can run on its own, while loading the tainting module is only complimentary.

The tutorial should run standalone, consequently we have to import a URL list. I.e., the first version might look as follows:
```javascript
async function seed() {
    await crawler.seed();
    await importer.csv({file: "eu.csv", limit: 100});
}
```

Here we import the first 100 URLs from the [eu.csv](../lists/eu.csv) list. 

Now we can think about the database setup. As this experiment is supposed to store the HTML code of a page and its meta tags, we have to add two database tables.

The table storing the HTML code itself could be initialized as this:
```javascript
await db.create(
    "htmldump(" +
    "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, final_url TEXT NOT NULL, html LONGTEXT NOT NULL," +
    "INDEX(root), INDEX(pid)" +
    ")"
);
```

The `root` and `pid` columns represent the IDs to track what page this code belongs to. `final_url` stores the URL after all redirects and stuff and `html` the dump of the page's code.

The meta tags can return more than 1 entry per page, so the table has to be structured accordingly. For example as follows:

```javascript
await db.create(
    "metatags(" +
    "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, name TEXT NOT NULL, value LONGTEXT NOT NULL," +
    "INDEX(root), INDEX(pid), INDEX(name)" +
    ")"
);
```
Together they now make up our seed function and we can test the module by running:
```sh
node main.js --task=seed --module=tutorial
```
If the connection to the database fails, have a look at [config.js](../config.js) and ensure the user has sufficient rights to create schemas and interact with tables inside them. You can overwrite the settings on the command line or adjust the config, but please do not push a changed config to the master branch. I will revert your changes if that is the case.

If the crawler outputs `All done.` the setup has completed and you can inspect the `_tutorial` schema in the database. It has 3 tables, the two we created above and `pages` which is the table used by the actual crawler. Make yourself familiar with the values in the `pages` table as having a basic understand of what they mean is helpful for using the crawler.. 

### Implementing the actual experiment

Next we think about what we want to extract from a page once it has loaded. That is, the page's HTML code, the URL we ultimately visited and all `meta` tags. We therefore create variables to hold these values once extracted so that they persist beyond the hook function where we can read them.
The general idea is to use the hooks as follows:
- `before`: Restore stored values to empty state
- `during`: Wait for dynamic content to load and then extract the features we are interested in, saving them.
- `after`: Store the data saved by `during` in the database.

Consequently, the `before` hook looks like this:
```javascript
async function before(params) {
    html = "";
    final_url = "";
    meta_tags = [];
}
```

The `during` hook is where the actual extraction happens. To wait for dynamic content to finish loading, we initially wait for 5 seconds and afterwards interact with the page. This interaction is defined by the [Playwright API](https://playwright.dev/docs/api/class-page).

The crawler offers access to the `Page` object inside these hooks by calling `crawler.page()`
So the initial version of the `during` hook can be written as follows:
```javascript

async function during(params) {
    await common.sleep(5000);
    let page = browser.page();
    html = await page.content();
    final_url = page.url();
}
```
The `content` and `url` functions are described in the Playwright API linked above. To extract the meta tags we have to run JavaScript code in the context of the page itself. This can be done by calling `page.evaluate`, for example like this:

```
meta_tags = await page.evaluate(() => {
    let meta = [];
    for(const t of document.getElementsByTagName("meta")) {
        let prop = t.getAttribute("property");
        let name = t.getAttribute("name");
        if(prop !== null && (prop.startsWith("og:") || prop.startsWith("twitter:")))    {
            meta.push({k: prop, v: t.content});
        }
        if(name !== null && (name.startsWith("og:") || name.startsWith("twitter:")))    {
            meta.push({k: name, v: t.content});
        }
    }
    return meta;
});
```
This retrieved all opencard and twitter meta tags from the page and stores them temporarily.

Finally, to save this data in the database, we implement the `after` hook with the corresponding SQL queries:
```javascript
async function after(params) {
    await db.query("INSERT INTO htmldump VALUES (?,?,?,?)", [params.root, params.pid, final_url, html]);
    if(meta_tags.length == 0) { return; }
    let data = [];
    for (const mt of meta_tags) {
        data.push([params.root, params.pid, mt.k, mt.v]);
    }
    await db.query("INSERT INTO metatags VALUES ?", [data]);
}
```

Please note that when using the array of arrays for inserting lists of data, you have to take care to not call it with an empty array. The first insert will always have data, as every visited page has a URL and some content. Meta tags are optional and correspondingly, we can't expect every page to have them.

Now we can run the crawler with:
```sh
node main.js --task=crawl --module=tutorial
```
and monitor the database for new entries.

The full example is provided in [tutorial.js](../modules/tutorial.js) and works on my machine (tm).

If you are unsure about the available option, it makes sense to familiarize yourself with the [Playwright API](https://playwright.dev/docs/api/class-playwright), as Playcrawler is effectively a fairly thin wrapper around Playwright. For a full overview over the options please have a look into [crawler.js](../core/crawler.js), [browser.js](../core/browser.js) and the [importer.js](../core/importer.js) module. Code is the best documentation after all..

### Disclaimer
The meta tag extraction as shown here is only partially working. Some pages deviate from the standard, such as amazon.com which used the (name,value) attribute pair to define twitter cards.

