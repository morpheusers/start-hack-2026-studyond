# Web Presentation Template

Write nice presentations using only Markdown. Check out the [published example](https://nickolausen.github.io/web-presentation-template/) at the repository link to see what you can do with it. Built with Hugo and RevealJS, inspired by [@DanySK](https://github.com/DanySK).

## How to run slides

### Linux / MacOSX

```bash
hugo serve
```

## How to deploy

This repository is set to deploy automatically to GitHub Pages on every push via [build-and-deploy.yml](.github/workflows/build-and-deploy.yml) worflow.

1. *On GitHub*, make sure to have Actions enabled on your repository. The option `Settings` > `Actions` > `Actions permissions` > `Allow all actions and reusable workflows` **must be checked**.

2. Make some changes to the local repository, commit and push them to GitHub.

3. *On GitHub*, go to the repository page and make sure `Settings` > `Pages` (menu on the left) > `Build and deployment` > `Source` is set to `Deploy from a branch`. Choose `gh-pages` as branch (on the selection menu).

4. Wait a little bit and, if you keep encounter error 404 at the GitHub Pages repository link, manually re-run the Action from the `Action` tab. 