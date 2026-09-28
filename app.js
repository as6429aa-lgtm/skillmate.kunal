import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, query, orderBy, onSnapshot, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAanV8gZP1Q5QElOJ1QxYZFCPTh-YkR6Is",
  authDomain: "skillmate-demo-2ac2f.firebaseapp.com",
  projectId: "skillmate-demo-2ac2f",
  storageBucket: "skillmate-demo-2ac2f.firebasestorage.app",
  messagingSenderId: "1054887771550",
  appId: "1:1054887771550:web:ef576451eb441eee8f2a8f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let mainMap = null;
let mainMarkers = [];
let formMap = null;
let formMarker = null;
// Default: BBDNITM / Lucknow
let userLocation = { lat: 26.7855, lng: 80.9139 };
let currentChatCircleId = null;
let currentChatUnsubscribe = null;

// ============ LEAFLET MAPS INIT ============
function initMaps() {
  // Main Map
  mainMap = L.map('map').setView([userLocation.lat, userLocation.lng], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(mainMap);

  // User location marker (green circle)
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: '<div style="background:#2D4A3E;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
    .addTo(mainMap)
    .bindPopup('<b>You are here</b><br>BBDNITM, Lucknow');

  // Form Map
  formMap = L.map('formMap').setView([userLocation.lat, userLocation.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(formMap);

  // Draggable marker for form
  const circleIcon = L.divIcon({
    className: 'circle-marker',
    html: '<div style="background:#2D4A3E;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:move;"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  formMarker = L.marker([userLocation.lat, userLocation.lng], {
    icon: circleIcon,
    draggable: true
  }).addTo(formMap);

  formMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    document.getElementById("circleLat").value = pos.lat;
    document.getElementById("circleLng").value = pos.lng;
  });

  document.getElementById("circleLat").value = userLocation.lat;
  document.getElementById("circleLng").value = userLocation.lng;

  // Try user's real location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mainMap.setView([userLocation.lat, userLocation.lng], 12);
      formMap.setView([userLocation.lat, userLocation.lng], 13);
      formMarker.setLatLng([userLocation.lat, userLocation.lng]);
      document.getElementById("circleLat").value = userLocation.lat;
      document.getElementById("circleLng").value = userLocation.lng;
    });
  }

  loadCircles();
  loadMapCircles();
}

// Init maps when page loads
window.addEventListener('load', () => {
  setTimeout(initMaps, 300);
});

// ============ AUTH ============
document.getElementById("loginBtn").onclick = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await addDoc(collection(db, "users"), {
      name: result.user.displayName,
      email: result.user.email,
      photo: result.user.photoURL,
      joinedAt: serverTimestamp()
    });
  } catch (e) {
    alert("Login failed: " + e.message);
  }
};

document.getElementById("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("logoutBtn").style.display = "inline-block";
    document.getElementById("userName").textContent = user.displayName;
    document.getElementById("hostSection").style.display = "block";
  } else {
    document.getElementById("loginBtn").style.display = "inline-block";
    document.getElementById("logoutBtn").style.display = "none";
    document.getElementById("userName").textContent = "";
    document.getElementById("hostSection").style.display = "none";
  }
  loadCircles();
  loadMapCircles();
});

// ============ CIRCLES ============
async function loadCircles() {
  const list = document.getElementById("circleList");
  if (!list) return;
  const snapshot = await getDocs(collection(db, "circles"));
  
  if (snapshot.empty) {
    list.innerHTML = `
      <div class="card" style="grid-column: 1/-1; text-align: center; padding: 48px;">
        <div class="card-emoji">🌱</div>
        <h3>No circles yet</h3>
        <p class="card-meta">Be the first to create one!</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = "";
  snapshot.forEach((d) => {
    const data = d.data();
    const div = document.createElement("div");
    div.className = "card";
    const emoji = {
      Cycling: "🚴", Reading: "📚", Gym: "💪",
      Photography: "📷", Music: "🎵", Running: "🏃"
    }[data.category] || "✨";
    
    const isMember = currentUser && data.members?.includes(currentUser.uid);
    
    div.innerHTML = `
      <div class="card-emoji">${emoji}</div>
      <h3>${data.name}</h3>
      <div class="card-meta">📍 ${data.location}</div>
      <div class="card-meta">👥 ${data.members?.length || 0} members</div>
      <span class="card-skill">${data.category}</span>
      <div class="card-actions">
        <button class="card-btn join-btn ${isMember ? 'joined' : ''}" data-id="${d.id}">
          ${isMember ? '✓ Joined' : 'Join Circle'}
        </button>
        ${isMember ? `<button class="card-btn chat-btn" onclick="openChat('${d.id}', '${data.name.replace(/'/g, "\\'")}')">💬 Chat</button>` : ''}
      </div>
    `;
    
    const joinBtn = div.querySelector(".join-btn");
    if (!isMember) {
      joinBtn.onclick = () => joinCircle(d.id, joinBtn);
    }
    
    list.appendChild(div);
  });
}

async function loadMapCircles() {
  if (!mainMap) return;
  mainMarkers.forEach(m => mainMap.removeLayer(m));
  mainMarkers = [];
  
  const snapshot = await getDocs(collection(db, "circles"));
  snapshot.forEach((d) => {
    const data = d.data();
    if (!data.lat || !data.lng) return;
    
    const circleIcon = L.divIcon({
      className: 'circle-pin',
      html: '<div style="background:#A8B5A0;width:18px;height:18px;border-radius:50%;border:3px solid #2D4A3E;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    
    const marker = L.marker([data.lat, data.lng], { icon: circleIcon })
      .addTo(mainMap)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; min-width: 150px;">
          <h3 style="margin: 0 0 6px 0; font-family: 'Playfair Display', serif; color: #2D4A3E; font-size: 16px;">${data.name}</h3>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #6B6B6B;">📍 ${data.location}</p>
          <p style="margin: 0; font-size: 13px; color: #6B6B6B;">👥 ${data.members?.length || 0} members</p>
        </div>
      `);
    
    mainMarkers.push(marker);
  });
}

async function joinCircle(circleId, btn) {
  if (!currentUser) {
    alert("Please login first!");
    document.getElementById("loginBtn").click();
    return;
  }
  const originalText = btn.textContent;
  btn.textContent = "⏳ Joining...";
  btn.disabled = true;
  try {
    const ref = doc(db, "circles", circleId);
    await updateDoc(ref, { members: arrayUnion(currentUser.uid) });
    btn.textContent = "✓ Joined";
    btn.classList.add("joined");
    setTimeout(() => { loadCircles(); }, 500);
  } catch (e) {
    alert("Error: " + e.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

document.getElementById("createForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const name = document.getElementById("circleName").value.trim();
  const location = document.getElementById("circleLocationName").value.trim();
  const category = document.getElementById("circleCategory").value;
  const lat = parseFloat(document.getElementById("circleLat").value);
  const lng = parseFloat(document.getElementById("circleLng").value);
  if (!name || !location) return;
  try {
    await addDoc(collection(db, "circles"), {
      name, location, category, lat, lng,
      hostId: currentUser.uid,
      hostName: currentUser.displayName,
      members: [currentUser.uid],
      createdAt: serverTimestamp()
    });
    document.getElementById("circleName").value = "";
    document.getElementById("circleLocationName").value = "";
    loadCircles();
    loadMapCircles();
    alert("✅ Circle created! Check the map.");
  } catch (e) {
    alert("Error: " + e.message);
  }
};

// ============ CHAT ============
window.openChat = async function(circleId, circleName) {
  if (!currentUser) return;
  currentChatCircleId = circleId;
  document.getElementById("chatTitle").textContent = circleName;
  document.getElementById("chatModal").classList.add("open");
  
  const circleDoc = await getDoc(doc(db, "circles", circleId));
  const circleData = circleDoc.data();
  document.getElementById("chatSubtitle").textContent = `📍 ${circleData.location} · 👥 ${circleData.members.length} members`;
  
  if (currentChatUnsubscribe) currentChatUnsubscribe();
  
  const messagesRef = collection(db, "circles", circleId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));
  
  currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("chatMessages");
    if (snapshot.empty) {
      container.innerHTML = `<div class="chat-empty">No messages yet.<br>Say hi to the group! 👋</div>`;
      return;
    }
    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isOwn = msg.userId === currentUser.uid;
      const time = msg.createdAt?.toDate?.() || new Date();
      const div = document.createElement("div");
      div.className = `msg ${isOwn ? "own" : "other"}`;
      div.innerHTML = `
        ${!isOwn ? `<div class="msg-sender">${msg.userName}</div>` : ""}
        <div>${escapeHtml(msg.text)}</div>
        <div class="msg-time">${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  });
};

window.closeChat = function() {
  document.getElementById("chatModal").classList.remove("open");
  if (currentChatUnsubscribe) {
    currentChatUnsubscribe();
    currentChatUnsubscribe = null;
  }
  currentChatCircleId = null;
};

window.sendMessage = async function() {
  if (!currentUser || !currentChatCircleId) return;
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  try {
    await addDoc(collection(db, "circles", currentChatCircleId, "messages"), {
      text,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userPhoto: currentUser.photoURL,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    alert("Error sending message: " + e.message);
  }
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeChat();
});