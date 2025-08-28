# Script Gadget Benchmark

This is a benchmark combining 15 different JavaScript libraries containing script gadget vulnerabilities with a website containing a markup injection vulnerability.
The vulnerable libraries are taken from https://github.com/google/security-research-pocs/tree/master/script-gadgets

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

The server runs on http://localhost:9000 and takes two query parameters. The markup injection vulnerability reads the url fragment and writes it to the DOM using `innerHTML`.
- `framework`: Selects the vulnerable library to include. Example: `framework=jquery`
- `decode`: Wether to urldecode the markup injection payload. Can be `true` or `false`. Default is `false`.

## URL list

```csv
http://localhost:9000/?framework=ajaxify
http://localhost:9000/?framework=angular
http://localhost:9000/?framework=aurelia
http://localhost:9000/?framework=bootstrap
http://localhost:9000/?framework=closure
http://localhost:9000/?framework=ember
http://localhost:9000/?framework=jquery
http://localhost:9000/?framework=jquerymobile
http://localhost:9000/?framework=jqueryui
http://localhost:9000/?framework=knockout
http://localhost:9000/?framework=polymer
http://localhost:9000/?framework=ractive
http://localhost:9000/?framework=requirejs
http://localhost:9000/?framework=vue
http://localhost:9000/?framework=webcomponents-polyfill
```
