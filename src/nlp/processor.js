 import natural from 'natural';
import * as chrono from 'chrono-node';

const classifier = new natural.LogisticRegressionClassifier();

// Initialize foundational fallback intent matrix cluster
const baselineIntents = [
  { text: 'hi hello good morning assistant receptionist greet welcome', label: 'greeting' },
  { text: 'thank you so much thanks bye talk to you later appreciate ok', label: 'goodbye' },
  { text: 'find look search doctor specialist clinic consult appointment check book', label: 'find_doctor' }
];
baselineIntents.forEach(item => classifier.addDocument(item.text, item.label));
classifier.train();

// Intelligent Semantic Mapping Rules (Maps descriptive terms to core base names)
const METABOLIC_MAP = {
  'chest pain': 'cardiologist', 'heart attack': 'cardiologist', 'palpitations': 'cardiologist',
  'skin rash': 'dermatologist', 'acne': 'dermatologist', 'pimple': 'dermatologist',
  'child': 'pediatrician', 'baby': 'pediatrician', 'kid': 'pediatrician', 'infant': 'pediatrician',
  'bone': 'orthopedist', 'joint': 'orthopedist', 'fracture': 'orthopedist', 'broken': 'orthopedist',
  'headache': 'general physician', 'fever': 'general physician', 'stomachache': 'general physician', 'cold': 'general physician',
  'toothache': 'dentist', 'cavity': 'dentist', 'teeth': 'dentist', 'gum': 'dentist'
};

export function parseIntentAndEntities(text, systemEntities = { cities: [], specializations: [], doctors: [] }) {
  const cleanText = text.toLowerCase().trim();
  console.log(`\n🗣️ Spoken Sentence: "${text}"`);

  // 1. Core Action Mapping
  const intent = classifier.classify(cleanText);

  // 2. Dynamic City Entity Picker
  let city = null;
  systemEntities.cities.forEach(c => {
    if (cleanText.includes(c.toLowerCase())) city = c.toLowerCase();
  });

  // Regular expression backup for unnamed localities ("in [city]")
  if (!city) {
    const cityMatch = cleanText.match(/in\s+([a-z]+)/i);
    if (cityMatch && cityMatch[1]) {
      const parsedWord = cityMatch[1].toLowerCase();
      if (!['the', 'a', 'my', 'this'].includes(parsedWord)) city = parsedWord;
    }
  }

  // 3. Dynamic Specialization Extraction
  let specialization = null;
  
  // Try mapping common symptoms first
  Object.keys(METABOLIC_MAP).forEach(symptom => {
    if (cleanText.includes(symptom)) {
      specialization = METABOLIC_MAP[symptom];
    }
  });

  // Direct confirmation match against active database specializations
  systemEntities.specializations.forEach(spec => {
    if (cleanText.includes(spec.toLowerCase())) specialization = spec.toLowerCase();
  });

  // 4. Dynamic Doctor Selection Processing
  let doctorName = null;
  systemEntities.doctors.forEach(doc => {
    const cleanDocName = doc.toLowerCase().replace('dr.', '').trim();
    if (cleanText.includes(cleanDocName) && cleanDocName.length > 2) {
      doctorName = doc; // Matches database format precisely
    }
  });

  // 5. Structural Date & Time Parsing via Chrono
  const dateResults = chrono.parse(cleanText);
  let appointmentDate = null;
  let appointmentTime = null;

  if (dateResults && dateResults.length > 0) {
    const parsedDate = dateResults.start.date();
    appointmentDate = parsedDate.toISOString().split('T')[0];
    
    if (dateResults.start.isCertain('hour')) {
      appointmentTime = parsedDate.toTimeString().split(' ')[0].substring(0, 5);
    }
  }

  return {
    intent,
    entities: { specialization, city, doctorName, appointmentDate, appointmentTime }
  };
}
