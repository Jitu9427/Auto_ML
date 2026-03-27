import requests
import json
import math
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get('/test')
def test():
    return {'val': math.nan}

client = TestClient(app)
try:
    response = client.get('/test')
    print('Status:', response.status_code)
    try:
        print('JSON:', response.json())
    except Exception as e:
        print('JSON Parse Error:', str(e))
        print('Text body:', response.text)
except Exception as e:
    print('Exception:', str(e))
