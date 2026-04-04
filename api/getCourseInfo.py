import json
import requests
from concurrent.futures import ThreadPoolExecutor

def get_courses_since_summer_2016():
    # Generate a list of semesters and years since summer 2016
    semesters = ['00', '10', '20', '15']  # Summer, Fall, Spring, Winter

    all_courses = []

    # Iterate through semesters and years
    for year in range(2016, 2024):

        for semester in semesters:
            # Construct srcdb value
            srcdb = str(year) + semester

            # Make cURL request and parse response asynchronously
            if srcdb != '202115':
                all_courses.extend(parse_courses(srcdb))
    return all_courses

def parse_courses(srcdb):
    url = 'https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N'
    headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
    }
    payload = {
        'other': {'srcdb': srcdb},
        'criteria': [{'field': 'is_ind_study', 'value': 'N'}, {'field': 'is_canc', 'value': 'N'}]
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        courses_data = response.json()
        return courses_data.get("results", [])
    else:
        print(f"Failed to fetch courses for srcdb: {srcdb}")
        return []

def get_course_details(course):
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
    payload = {
        'group': f'code:{course["code"]}',
        'key': f'crn:{course["crn"]}',
        'srcdb': str(course['srcdb'])
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to fetch details for course: {course['code']}")
        return None

def save_courses_to_file(courses, filename):
    with open(filename, 'w') as file:
        json.dump(courses, file, indent=4)

# Main function
if __name__ == "__main__":
    # Step 1: Get courses since summer 2016
    courses = get_courses_since_summer_2016()

    # Step 2: Get course details asynchronously
    with ThreadPoolExecutor(max_workers=10) as executor:
        course_details = list(executor.map(get_course_details, courses))

    # Step 3: Save course details to a file
    save_courses_to_file(course_details, 'courses.txt')
