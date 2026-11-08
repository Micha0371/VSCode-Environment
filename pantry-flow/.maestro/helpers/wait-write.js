var response = http.get('http://127.0.0.1:54329/__test/wait-write');
if (!response.ok) throw new Error('Local test proxy unavailable');
output.pendingWrites = json(response.body).pendingWrites;
output.writeStarted = json(response.body).writeStarted;
output.polls = (output.polls || 0) + 1;
