import natural from 'natural';
import nlpCompromise from 'compromise';
import * as chrono from 'chrono-node';

const classifier = new natural.LogisticRegressionClassifier();

// Train Intent Classifier
const trainingData = [
  { text: 'find me a cardiologist in delhi', label: 'find_doctor' },
  { text: 'look up top rated dermatologists', label: 'find_doctor' },
  { text: 'are there any orthopedists available in mumbai', label: 'find_doctor' },
  { text: 'i need an appointment with Dr. Amit tomorrow at 4pm', label: 'book_appointment' },
  { text: 'book Dr Priya for next monday at 10 am', label: 'book_appointment' },
  { text: 'schedule a booking with Dr. Rohan', label: 'book_appointment' },
  { text: 'cancel my booking for tomorrow', label: 'cancel_appointment' },
  { text: 'remove my appointment with doctor amit', label: 'cancel_appointment' }
];

trainingData.forEach(item => classifier.addDocument(item.text, item.label));
classifier.train();

export function parseIntentAndEntities(text) {
  const cleanText = text.toLowerCase().trim();
  
  // 1. Intent Detection
  const intent = classifier.classify(cleanText);

  // 2. Entity Extraction via compromise
  const doc = nlpCompromise(cleanText);
  
  // Extract Cities
  const cities = ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata' , 'lucknow', 'hyderabad', 'pune', 'jaipur', 'ahmedabad'  ];
  let city = null;
  cities.forEach(c => { if (cleanText.includes(c)) city = c; });

  // Extract Specializations
  const specializations = ['cardiologist', 'dermatologist', 'pediatrician', 'orthopedist', 'neurologist'];
  let specialization = null;
  specializations.forEach(s => { if (cleanText.includes(s)) specialization = s; });

  // Extract Doctor Names
  let doctorName = null;
  const nameMatch = cleanText.match(/dr\s*\.?\s*([a-z]+)/i);
  if (nameMatch) {
    doctorName = `Dr. ${nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1)}`;
  }

  // 3. Date & Time Parsing via chrono-node
  const dateResults = chrono.parse(cleanText);
  let appointmentDate = null;
  let appointmentTime = null;

  if (dateResults && dateResults.length > 0) {
    const parsedDate = dateResults[0].start.date();
    appointmentDate = parsedDate.toISOString().split('T')[0];
    
    // Check if a specific time context was parsed
    if (dateResults[0].start.isCertain('hour')) {
      appointmentTime = parsedDate.toTimeString().split(' ')[0].substring(0, 5);
    }
  }

  return {
    intent,
    entities: {
      specialization,
      city,
      doctorName,
      appointmentDate,
      appointmentTime
    }
  };
}
