from flask import Flask, send_file, request, Response
import random
import json

app = Flask(__name__)

@app.route('/')
def home():
    return send_file('index.html')


@app.route('/inventory')
def inventory():
    id = request.args.get('id')
    price = random.randint(10, 500)
    return Response(json.dumps({'name': id.title(), 'price': price}), mimetype='application/json')

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=80)
