from flask import Flask, render_template, request, send_from_directory

app = Flask(__name__)

@app.route('/')
def home():
    framework = request.args.get('framework', '')

    if framework == '':
        return render_template('index.html', title="None", framework="")

    framework_path = f"templates/{framework}.html"
    with open(framework_path, 'r') as file:
        framework_content = file.read()
        return render_template('index.html', title=framework, framework=framework_content)

@app.route('/<path:filename>')
def serve_script(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=9000)
