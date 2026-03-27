import requests

# Call apply_step with missing dataset to trigger 404
payload = {
    'dataset_id': 'invalid-uuid',
    'columns': ['A'],
    'technique': 'imputation',
    'method': 'mean',
    'params': {}
}
r2 = requests.post('http://localhost:8000/api/v1/preprocess/apply_step', json=payload)
print("Invalid dataset status:", r2.status_code)
print("Invalid dataset payload:", repr(r2.text))
