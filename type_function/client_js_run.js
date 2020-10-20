fetch('/graphql', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    body: JSON.stringify({
        query: `{ course(id:1) {
          title
          author
          description
          topic
          url
      } }`})
})
    .then(r => r.json())
    .then(data => console.log('data returned:', data));