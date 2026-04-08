from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
import os
import time 
import json
import tempfile
from selenium.webdriver.chrome.options import Options

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(BASE_DIR, ".chrome-scraper-profile")
OUTPUT_PATH = os.path.join(BASE_DIR, "data", "all_courses.json")
TEMP_PROFILE_DIR = tempfile.mkdtemp(prefix="cabby-cab-profile-")
INTERACTIVE_LOGIN = os.environ.get("SCRAPER_LOGIN", "0") == "1"
HEADLESS = os.environ.get("SCRAPER_HEADLESS", "1") == "1" and not INTERACTIVE_LOGIN

def build_driver(user_data_dir, headless):
    chrome_options = Options()
    chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    if headless:
        chrome_options.add_argument("--headless=new")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

## OPTIONS
department_value = "CSCI"
blacklist_course_codes = ["CSCI 2450", "ECON 2450", "ECON 2950", "ECON 2930", "ECON 2960", "ECON 2970"]
driver = build_driver(TEMP_PROFILE_DIR, HEADLESS)
wait = WebDriverWait(driver, 60) # max 15 second timeout
critical_review_driver = None
critical_review_wait = None
critical_review_available = True

print(f"Using Chrome profile: {PROFILE_DIR}", flush=True)
print(f"Using CAB temp profile: {TEMP_PROFILE_DIR}", flush=True)
print(f"Headless mode: {HEADLESS}", flush=True)
print(f"Interactive login mode: {INTERACTIVE_LOGIN}", flush=True)


def save_courses(courses):
    with open(OUTPUT_PATH, "w") as f:
        json.dump(courses, f)
    print(f"Checkpoint saved: {len(courses)} courses", flush=True)


def select_term(term_value):
    for _ in range(3):
        try:
            dropdown = wait.until(EC.presence_of_element_located((By.ID, "crit-srcdb")))
            Select(dropdown).select_by_value(term_value)
            return
        except StaleElementReferenceException:
            time.sleep(1)
    raise StaleElementReferenceException("Could not select CAB term after retries.")


def wait_for_results():
    wait.until(
        lambda current_driver: len(
            current_driver.find_elements(By.CSS_SELECTOR, ".result--group-start .result__link")
        ) > 0
    )


def get_critical_review_driver():
    global critical_review_driver, critical_review_wait
    if critical_review_driver is None:
        critical_review_driver = build_driver(PROFILE_DIR, HEADLESS)
        critical_review_wait = WebDriverWait(critical_review_driver, 60)
    return critical_review_driver, critical_review_wait

## Open cab.brown.edu
def scrape_all_courses(include_critical_review=False):
    url = "https://cab.brown.edu/"

    driver.get(url)
    print("got URL:", driver.current_url)
    wait.until(EC.presence_of_element_located((By.ID, "crit-srcdb")))
    print("Page loaded")

    ## Select "Computer Science" under "Advanced Search"
    # dropdown = driver.find_element(By.ID, 'crit-dept')
    # select = Select(dropdown)
    # select.select_by_value(department_value)

    ## Select term in the first dropdown
    select_term("999999") # '999999' is the option value for 'Any Term (2026-27)'

    ## Click "Find Courses"
    button = wait.until(EC.element_to_be_clickable((By.ID, "search-button")))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
    time.sleep(0.25)
    driver.execute_script("arguments[0].click();", button)
    print("clicked find courses", flush=True)

    wait_for_results()
    print("results loaded", flush=True)

    # For each course
    total = len(driver.find_elements(By.CSS_SELECTOR, '.result--group-start .result__link'))
    print(f"{total} Courses", flush=True)
    COURSES = []
    first = True
    for i in range(total):
        try:
            print(f"[{i+1}/{total}] Clicking course...", flush=True)
            time.sleep(2)
            # Re-fetch elements each iteration to avoid stale references after DOM updates
            results = driver.find_elements(By.CSS_SELECTOR, '.result--group-start .result__link')
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", results[i])
            time.sleep(0.25)
            results[i].click()
            course_data = scrape_course(include_critical_review, first=first)
            COURSES.append(course_data)
            first = False
            if len(COURSES) % 100 == 0:
                save_courses(COURSES)
            print(f"[{i+1}/{total}] Done: {course_data['code']} - {course_data['title']}", flush=True)
        except Exception as e:
            print(f"[{i+1}/{total}] Failed: {e}", flush=True)
    return COURSES


def scrape_course(include_critical_review=False, first=False):
    course_data = {}
    #  Click on course
    time.sleep(2)
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dtl-course-code")))

    non_clickable_section = driver.find_elements(By.CLASS_NAME, "dtl-section")
    if len(non_clickable_section) == 0:
        #  Click S01
        section_01 = driver.find_element(By.CSS_SELECTOR, "a.course-section.course-section--matched")
        section_01.click()
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "dtl-section")))
    
    # Grab course code
    course_data["code"] = driver.find_element(By.CLASS_NAME, "dtl-course-code").text

    if course_data["code"] in blacklist_course_codes:
        raise Exception("course in blacklist")
    if course_data["code"] in ["APMA 2990", "ECON 2990", "MATH 2970"]:
        raise Exception("course is 'Examination'")

    # Grab term
    course_data["term"] = driver.find_element(By.CLASS_NAME, "detail-srcdb").text
    
    # Grab title
    course_data["title"] = driver.find_element(By.CLASS_NAME, "detail-title").text

    # Grab description
    course_data["description"] = driver.find_element(By.CSS_SELECTOR, ".section--description .section__content").text

    # Grab instructor
    course_data["instructor"] = driver.find_element(By.CSS_SELECTOR, ".section--instructordetail_html").text

    # grab time & location
    try:
        course_data["schedule"] = driver.find_element(By.CSS_SELECTOR, ".section--meeting_html").text
    except Exception:
        pass

    try:
        course_data["programs"] = driver.find_element(By.CSS_SELECTOR, ".section--attr_html").text
    except Exception:
        pass

    # Add prereqs (split)
    # prereq_elements = driver.find_elements(By.CLASS_NAME, "prereq")
    # if len(prereq_elements) == 1:
    #     prereq_text = driver.find_element(By.CLASS_NAME, "prereq").text
    #     course_data["prereq_text"] = prereq_text
    #     prereq_text = prereq_text.split(": ")[1]
    #     remove = ["(",")"," or minimum score of WAIVE in 'Graduate Student PreReq",".","*","'","\n"," May be taken concurrently"]
    #     replace_with_comma = [" or ", " and "]
    #     for to_remove in remove:
    #         prereq_text = prereq_text.replace(to_remove, "")
    #     for to_replace in replace_with_comma:
    #         prereq_text = prereq_text.replace(to_replace, ", ")
    #     prereqs = prereq_text.split(", ")
    #     last_department = "NULL"
    #     processed_prereqs = []
    #     for prereq in prereqs:
    #         if len(prereq) == 4:
    #             processed_prereqs.append(last_department + " " + prereq)
    #         else:
    #             processed_prereqs.append(prereq)
    #             last_department = prereq.split(" ")[0]
    #     course_data["prereqs"] = processed_prereqs
    #     print(processed_prereqs)
    # else:
    #     course_data["prereqs"] = []
    #     course_data["prereq_text"] = "NA"

    if include_critical_review:
        data = scrape_course_on_critical_review(driver, wait, first=first)
        for key, value in data.items():
            course_data[key] = value

    print(f"  Scraped CAB data for {course_data['code']}", flush=True)
    return course_data

def scrape_course_on_critical_review(driver, wait, first=False):
    global critical_review_available
    data = {}
    if not critical_review_available:
        return data

    # Open critical review link in new tab
    critical_review_links = driver.find_elements(By.CSS_SELECTOR, ".detail-resources_critical_review_html a")
    if len(critical_review_links) == 0:
        return data

    critical_review_link = critical_review_links[0]
    data["critical_review_url"] = critical_review_link.get_attribute("href")
    cr_driver, cr_wait = get_critical_review_driver()
    cr_driver.get(data["critical_review_url"])

    try:
        short_wait = WebDriverWait(cr_driver, 10)

        if first:
            old_login_page = len(cr_driver.find_elements(By.ID, "brown-brand")) != 0
            if old_login_page:
                print("Old Brown login page detected, but this scraper now expects a saved browser session.", flush=True)

        login_required = "/login" in cr_driver.current_url or "Sign in with Google" in cr_driver.find_element(By.TAG_NAME, "body").text
        if login_required:
            if HEADLESS:
                print("Critical Review requires an existing saved login session. Run once with SCRAPER_LOGIN=1 and sign in manually.", flush=True)
                critical_review_available = False
                return {}

            print("Complete the Critical Review login in the browser window, then return here and press Enter.", flush=True)
            input()
            short_wait.until(lambda current_driver: "/login" not in current_driver.current_url)
            login_required = "/login" in cr_driver.current_url or "Sign in with Google" in cr_driver.find_element(By.TAG_NAME, "body").text
            if login_required:
                print("Still not logged into Critical Review; skipping CR data for this run.", flush=True)
                critical_review_available = False
                return {}

        short_wait.until(EC.presence_of_element_located((By.ID, "logo")))

        course_title_elements = cr_driver.find_elements(By.ID, "course_title")
        print("course title elements len:", len(course_title_elements), flush=True)
        if len(course_title_elements) != 0:
            # Grab avg/max hours
            avg_hrs = cr_driver.find_element(By.CSS_SELECTOR, "#statistics_panel > div.stats_without_header > table > tbody > tr:nth-child(2) > td:nth-child(1) > div > div.value").text
            max_hrs = cr_driver.find_element(By.CSS_SELECTOR, "#statistics_panel > div.stats_without_header > table > tbody > tr:nth-child(2) > td:nth-child(2) > div > div.value").text
            
            # Grab ratings
            course_rating = cr_driver.find_element(By.CSS_SELECTOR, "#statistics_panel > div.stats_without_header > table > tbody > tr:nth-child(1) > td:nth-child(1) > div > div.value").text
            professor_rating = cr_driver.find_element(By.CSS_SELECTOR, "#statistics_panel > div.stats_without_header > table > tbody > tr:nth-child(1) > td:nth-child(2) > div > div.value").text
            
            # grab description
            desc = cr_driver.find_element(By.CSS_SELECTOR, "#full_review_contents").text
            
            professor_and_term = cr_driver.find_element(By.CSS_SELECTOR, ".course_code").text
            
            data = {"average_hours": avg_hrs, "max_hours": max_hrs, "course_rating": course_rating, "professor_rating": professor_rating, "description": desc, "professor_and_term": professor_and_term}
        else:
            print("No Critical Review entry", flush=True)
    except TimeoutException:
        print("Timed out loading Critical Review page; skipping CR data for this course.", flush=True)

    return data

if __name__ == "__main__":
    try:
        courses = scrape_all_courses(include_critical_review=True)
        save_courses(courses)
    finally:
        driver.quit()
        if critical_review_driver is not None:
            critical_review_driver.quit()
        
        
# TODO - some courses on cab don't have all the field so make everything in scrape course optional