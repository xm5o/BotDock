# Publishing BotDock

This repo already includes a Windows release workflow.

## First publish

1. Create a public GitHub repository named `BotDock`.
2. Push this project to the new repository.
3. Open the repository Actions tab and confirm Actions are enabled.
4. Create and push the first version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will build the Windows installer and portable executable.

When the build finishes, the files are attached to the GitHub Release automatically.

## Next release

Update the version in `package.json`, commit the changes, then create a new tag.

Example:

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Release files

The workflow uploads files from:

```text
dist/*.exe
```

The release also gets GitHub's normal source code archives.
