# __PLUGIN_ID__

TODO: what it does, in one sentence.

The plugin id lives in one place: `name` in `package.json`. No code or doc
repeats it. To rename the plugin, edit that field and reinstall.

```bash
./scripts/install.sh __NAME__      # build + copy to ~/.jimcast/plugins/__PLUGIN_ID__/
```

Panel entry for `config_section.json`:

```json
{ "id": "__PLUGIN_ID__", "label": "__NAME__", "kind": "external-component" }
```

CLI (the alias is the last id segment):

```bash
jimcast widget commands __NAME__
```
