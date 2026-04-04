import json
import requests


all_courses = json.load(open("/tmp/courses.txt", "r"))
courses = []
# print(all(["crn" in course for course in course_dict["results"]]))

url = 'https://cab.brown.edu/api/?page=fose&route=details'
headers = {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'cookie': '_ga=GA1.1.632293683.1706150266; _ga_2PZ0PTDGV6=GS1.1.1706220730.3.0.1706220730.0.0.0; _ga_QY13L4Q0C0=GS1.1.1706220730.3.0.1706220885.0.0.0; _ga_XB3WGZ6PTX=GS1.1.1706220880.2.0.1706220885.0.0.0; _ga_S0MX9K9C18=GS1.1.1706220730.2.0.1706220885.0.0.0; IDMSESSID=572A90198FD3D3B67B05CD9490F058A54D669CBAC422D7F36362C4269EB270AA98F5EE06A929B75A92CFB9B3C3DD8201; TS01b3a32b=014b44e76b33eb8c3c8cba0cdbd5ed4172d979c366d56c8185d459ddf9638047f300e1a6ae192370d1d344f4937c86c24635042e2c',
    'origin': 'https://cab.brown.edu',
    'priority': 'u=1, i',
    'referer': 'https://cab.brown.edu/',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest'
}

count = 0

for course in all_courses["results"]:
    count += 1
    payload = {
        'group': 'code:' + str(course['code']),
        'key': 'crn:'+ str(course['crn']),
        'srcdb': str(course['srcdb'])
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        data = response.json()
        courses.append(data)
        print(count)
    else:
        print("AAAAAA!!!")
        break

# Write the courses list to a JSON file
with open("spring2024.txt", "w") as outfile:
    json.dump(courses, outfile)









