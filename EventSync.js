// EventSync Campus Edition is a simple live scheduling tool for students and small teams. It displays the team's weekly plan from Monday to Friday in an easy to read calendar view and lets every team member add their own classes and events on one shared calendar. To add a event, click an empty slot to open a panel where you can enter your name, class name and duration. A random color will be assigned to each unique username, and all events under the same username will be filled with the same color. 

// EventSync uses Firebase, so additions, edits, or deletions on events updates the database and appears instantly on the page without reloading the page. You can use it for study group planning, scheduling meetings, or any campus events. All data is stored in the cloud and stays synchronized. 

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc, 
  onSnapshot,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyAiJzioo0m8ZUYXbWyDfs8RDAgD81CkRco",
  authDomain: "mstu5013---activity.firebaseapp.com",
  databaseURL: "https://mstu5013---activity.firebaseio.com",
  projectId: "mstu5013---activity"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore();
const eventSyncRef = collection(db, "eventSync");

const App = Vue.createApp({
  data() {
    return {
      panelStyle: { top: '0px', left: '0px' },
      userColors: {},
      classForm: {
        id: "",
        username: "",
        classname: "",
        day: "",
        start: "",
        end: "", 
        duration: 0.5,
        isGroup: false
      },
      classSchedule: [],
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      hours: Array.from({ length: (22 - 8) + 1 }, (_, i) => 8 + i)
    };
  },
 
  computed: {
    hourHasClass() {
      const map = {};
      for (let h = 8; h <= 22; h++) {
        map[h] = this.classSchedule.some(classForm => {
          const [startH, startM] = classForm.start.split(':').map(Number);
          const [endH, endM] = classForm.end.split(':').map(Number);
          const totalStart = startH * 60 + startM;
          const totalEnd = endH * 60 + endM;
          const blockStart = h * 60;
          const blockEnd = (h + 1) * 60;
          return totalStart < blockEnd && totalEnd > blockStart;
        });
      }
      return map;
    }
  },
  
  methods: {
    // Generate a random color for new users
    getColor(username) { 
      if (!this.userColors[username]) {
        const hue = Math.floor(Math.random() * 360);
        this.userColors[username] = `hsl(${hue}, 70%, 90%)`;
      }
      return this.userColors[username];
    },
    
    selectSlot(day, hour, event) {
      this.classForm.id = ""; 
      this.classForm.username = "";
      this.classForm.classname = "";
      this.classForm.duration = 0.5;
      
      const [h, m] = hour.split(':').map(Number);
      
      this.classForm.day = day;
      this.classForm.start = hour;
      this.classForm.end = "";
      
      this.panelStyle.top  = `${event.clientY}px`;
      this.panelStyle.left = `${event.clientX}px`;
    },
    
    // used to give the selected slot a color
    isSelected(day, hour) {
      return this.classForm.day === day && this.classForm.start === hour;
    },
    
    // ---- AddClass start --- Store the class form in firestore
    async addClass() {
      if (!this.classForm.username || 
          !this.classForm.classname || 
          !this.classForm.day) {
          return alert("Fill in name, class, and select a slot first.");
      }
      
      const [hour, minute] = this.classForm.start.split(':').map(Number);
      const startMinutes    = hour * 60 + minute;
      const durationMinutes = this.classForm.duration * 60;
      const endMinutes      = startMinutes + durationMinutes;
      const endHourStamp    = Math.floor(endMinutes / 60);
      const endMinuteStamp  = endMinutes % 60 === 0 ? '00' : '30';
      this.classForm.end    = `${endHourStamp}:${endMinuteStamp}`;
      
      const classRef = this.classForm.id 
                     ? doc(db, "eventSync", this.classForm.id) 
                     : doc(eventSyncRef);
      
      await setDoc(classRef, {
        username:   this.classForm.username,
        classname:  this.classForm.classname,
        day:        this.classForm.day,
        start:      this.classForm.start,
        end:        this.classForm.end,
        color:      this.getColor(this.classForm.username), 
        duration:   this.classForm.duration, 
        isGroup:    this.classForm.isGroup, 
        attendees: []
      });
      console.log("Saved:", classRef.id);

      this.classForm = {
        id: "", 
        username: "", 
        classname: "", 
        day: "", 
        start: "", 
        end: "", 
        duration: 0.5, 
        isGroup: false
      };
    }, 
    // ---- AddClass end
    
    // called when rendering classes, returns a single class object
    filterClass(day, hour) {
      // filter the array and find the single event matching this slot
      return this.classSchedule.filter(classForm => {
         if (classForm.day !== day) return false;
         const [slotHour, slotMinute] = hour.split(':').map(Number);
         const totalMinutes = slotHour * 60 + slotMinute;
        
         const [startHour, startMinute] = classForm.start.split(':').map(Number);
         const [endHour, endMinute] = classForm.end.split(':').map(Number);
        
         const startTotalMinutes = startHour * 60 + startMinute;
         const endTotalMinutes = endHour * 60 + endMinute;
        
         return totalMinutes >= startTotalMinutes && totalMinutes < endTotalMinutes;
       });
    },
    
    // Calls when user wants to cancel the current selection of the slot
    cancelSelection() {
      this.classForm = {
        id: "", 
        username: "", 
        classname: "", 
        day: "", 
        start: "", 
        end: "", 
        duration: 0.5, 
        isGroup: false
      };
    },
    
    deleteClassById(id) {
    const classRef = doc(eventSyncRef, id);
    deleteDoc(classRef);
    },
    
    // Delets the class from firestore
    async deleteClass() {
      if (!this.classForm.id) return;
      let classRef = doc(eventSyncRef, this.classForm.id);
      await deleteDoc(classRef);
      this.cancelSelection();
    }, 
    
    async attend(c) {                                    
     const name = (c.newAttendee || "").trim(); 
     if (!name) return alert("Enter your name to attend");
     const classRef = doc(db, "eventSync", c.id);
     await updateDoc(classRef, {attendees: arrayUnion(name)});
     c.newAttendee = "";
   },
  },
  
  mounted() {
    onSnapshot(eventSyncRef, snap => {
      this.classSchedule = snap.docs.map(d => ({
        id: d.id,
        ...d.data(), 
        newAttendee: ""
      }));

      this.classSchedule.forEach(c => {
        if (c.username && c.color) {
          this.userColors[c.username] = c.color;
        }
      });
    });
  }
});

App.mount("#app");
