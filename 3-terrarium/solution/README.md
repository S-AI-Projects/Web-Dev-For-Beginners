# My Terrarium: A project to learn about HTML, CSS, and DOM manipulation using JavaScript 🌵🌱

A small drag and drop code-meditation. With a little HTML, JS and CSS, you can build a web interface, style it, and add an interaction.

![my terrarium](../images/screenshot_gray.png)

## Credits

Written with ♥️  by [Jen Looper](https://www.twitter.com/jenlooper)

The terrarium created via CSS was inspired by Jakub Mandra's glass jar [codepen](https://codepen.io/Rotarepmi/pen/rjpNZY).

The artwork was hand drawn by [Jen Looper](http://jenlooper.com) using Procreate.

## Deploy your Terrarium

You can deploy, or publish your terrarium to the web using Azure Static Web Apps. 

1. Fork this repo

2. Press this button

[![Deploy to Azure button](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/?feature.customportal=false&WT.mc_id=academic-77807-sagibbon#create/Microsoft.StaticApp)

3. Walk through the wizard creating your app. Make sure you set the app root to either be `/solution` or the root of your codebase. There's no API in this app, so don't worry about adding that. A .github folder will be created in your forked repo that will help Azure Static Web Apps' build service build and publish your app to a new URL.

## Local layout and motion-preference check

The page has no keyframe animation, but navigation and footer links use short color transitions. A `prefers-reduced-motion: reduce` rule disables animations and transitions while preserving the layout. Keyboard focus on navigation links has a contrasting background and shadow. To regress these behaviors at mobile and desktop widths, install the course-check dependency and run from the repository root:

```bash
npm install --prefix tests/course
node tests/course/r59-t049.mjs
```

The check starts a local Python HTTP server and verifies the page, plant-selection region, left container, and first plant under normal and reduced-motion emulation at 360×800 and 1280×800. Reduced motion preserves the static layout, and Tab focus remains visible and within the viewport. The check does not simulate touch hardware or change the drag-and-drop interaction.



