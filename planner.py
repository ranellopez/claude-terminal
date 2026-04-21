import anthropic
import sqlite3
import json
import random
import os
import sys
from datetime import date, timedelta

DB_PATH = "planner.db"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

MEALS = []       # populated in Task 3
EXERCISES = []   # populated in Task 3
REST_ACTIVITIES = []  # populated in Task 3


def main():
    print("Planner starting...")


if __name__ == "__main__":
    main()
