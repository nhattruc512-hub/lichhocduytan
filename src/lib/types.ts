export type Meeting = {
  day: number;
  start: string;
  end: string;
  room: string;
};

export type CourseClass = {
  id: string;
  courseCode: string;
  courseName: string;
  classType: string;
  registrationCode: string;
  semester: string;
  credits: number;
  lecturer: string;
  capacity: number;
  registered: number;
  available: number;
  registrationStatus: string;
  startDate: string;
  endDate: string;
  meetings: Meeting[];
  source: "dtu";
  sourceUrl?: string;
};
