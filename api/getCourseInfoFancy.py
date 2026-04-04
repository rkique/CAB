import json
import asyncio
import aiohttp

async def fetch_data(session, url, payload):
    async with session.post(url, json=payload) as response:
        if response.status == 200:
            return await response.json()
        else:
            print(f"Failed to fetch data from {url}")
            return None

async def parse_courses(session, srcdb):
    url = 'https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N'
    payload = {
        'other': {'srcdb': srcdb},
        'criteria': [{'field': 'is_ind_study', 'value': 'N'}, {'field': 'is_canc', 'value': 'N'}]
    }
    response_data = await fetch_data(session, url, payload)
    if response_data:
        courses = response_data.get("results", [])
        if courses:
            print(f"Successfully fetched {len(courses)} courses for {srcdb}")
        return courses
    return []

async def get_course_details(session, course, index, total):
    url = 'https://cab.brown.edu/api/?page=fose&route=details'
    payload = {
        'group': f'code:{course["code"]}',
        'key': f'crn:{course["crn"]}',
        'srcdb': str(course['srcdb'])
    }
    course_detail = await fetch_data(session, url, payload)
    if course_detail:
        print(f"Fetched details for {course['code']} ({index + 1} of {total})")
    else:
        print(f"Failed to fetch details for {course['code']} ({index + 1} of {total})")
    return course_detail

async def get_courses_since_summer_2016():
    semesters = ['00', '10', '20', '15']  # Summer, Fall, Spring, Winter
    all_courses = []
    async with aiohttp.ClientSession() as session:
        for year in range(2016, 2024):
            for semester in semesters:
                srcdb = str(year) + semester
                if srcdb != '202115':
                    courses = await parse_courses(session, srcdb)
                    all_courses.extend(courses)
    return all_courses

async def main():
    courses = await get_courses_since_summer_2016()
    total_courses = len(courses)
    print(f"Starting to fetch details for {total_courses} courses...")

    async with aiohttp.ClientSession() as session:
        course_details = await asyncio.gather(*(
            get_course_details(session, course, index, total_courses) for index, course in enumerate(courses)
        ))

    with open('courses.json', 'w') as file:
        json.dump(course_details, file, indent=4)

if __name__ == "__main__":
    asyncio.run(main())
