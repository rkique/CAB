import json
from bs4 import BeautifulSoup
import csv

# Load courses from JSON file
with open("courses.json", "r") as file:
    courses = json.load(file)

season = {'00': "summer", '10': "fall", '20': "spring", '15': "winter"}

for course in courses:
    if course:
        # Parse the seats HTML
        soup_seats = BeautifulSoup(course['seats'], 'html.parser')
        seats_max = soup_seats.find('span', class_='seats_max')
        seats_avail = soup_seats.find('span', class_='seats_avail')
        course['num_seats'] = seats_max.text if seats_max else "Unknown"
        course['num_enrolled'] = str(int(seats_max.text) - int(seats_avail.text)) if seats_max and seats_avail else "Unknown"

        # Parse the instructor details
        soup_instructor = BeautifulSoup(course['instructordetail_html'], 'html.parser')
        instructor_name = soup_instructor.find('a')
        course['instructor'] = instructor_name.text if instructor_name else "Unknown"

        # Parse meeting details
        soup_meeting = BeautifulSoup(course['meeting_html'], 'html.parser')
        meeting_time = ' '.join(soup_meeting.get_text().split()[:2]) if soup_meeting else "Unknown"
        meeting_location = soup_meeting.find('a').text if soup_meeting.find('a') else "Unknown"
        course['meeting_time'] = meeting_time
        course['location'] = meeting_location

        # Clean description and count links
        soup_description = BeautifulSoup(course['description'], 'html.parser')
        links = soup_description.find_all('a')
        course['num_links'] = len(links)
        for link in links:
            link.decompose()  # This removes the link tags entirely
        course['description'] = soup_description.get_text(strip=True)

        # Season and year extraction
        course['season'] = season[course['srcdb'][-2:]]
        course['year'] = course['srcdb'][:4]

# Keys for TSV
fieldnames = ['key', 'permreq', 'rpt', 'code', 'section', 'title', 'instructor', 'num_seats', 'num_enrolled', 'description', 'num_links', 'clssnotes', 'registration_restrictions', 'attr_html', 'regdemog_html', 'meeting_time', 'location', 'year', 'season']

# Write to 
with open('courseData.tsv', 'w', newline='', encoding='utf-8') as tsvfile:
    writer = csv.DictWriter(tsvfile, fieldnames=fieldnames, delimiter='\t', quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for course in courses:
        if course is not None:
            row = {key: str(course.get(key, "Unknown")).replace('\u2028', '').replace('\u2029', '') for key in fieldnames}
            writer.writerow(row)

print("Data saved to courseData.tsv")
