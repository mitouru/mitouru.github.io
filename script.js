// Loading models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
  faceapi.nets.faceExpressionNet.loadFromUri('./models')
]).then(startVideo)


// To start the videoElement stream
const videoElement = document.getElementById('video')

// if (navigator.mediaDevices.getUserMedia) {
//   navigator.mediaDevices.getUserMedia({
//       video: true
//   })
//       .then(function (stream) {
//           videoElement.srcObject = stream;
//           videoElement.play();
//           console.log('Got videoElement!')
//       })
//       .catch(function (error) {
//           console.log('Error:', error)
//       });
// }

videoElement.setAttribute('playsinline', '');
videoElement.setAttribute('autoplay', '');
videoElement.setAttribute('muted', '');

function startVideo() {
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    })
    .then(function (stream) {
      videoElement.srcObject = stream;
      videoElement.play();
      console.log('Got videoElement!')
    })
    .catch(function (error) {
      console.log('Error:', error)
    });
  }
  // navigator.mediaDevices.getUserMedia(
  //   {video: true },
  //   stream => videoElement.srcObject = stream,
  //   err => console.error(err)
}


// * Capture the best frame utils
function captureFrame(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Image types and quality of images
  bestFrame = canvas.toDataURL('image/jpeg', 0.1); // Store the frame as a data URL

  return bestFrame
}

function downloadBestSmileImage() {
  if (bestFrame) {

    // Open in New Tab
    const newTab = window.open();
    newTab.document.write(`<img src="${bestFrame}" alt="Best Smiling Image">`);
    newTab.document.close();

    // Download to the device
    // const link = document.createElement('a');
    // link.href = bestFrame;
    // link.download = 'best_smile_image.png';
    // link.click();
  }
}

// Add a click event listener to the download button
const downloadBtn = document.getElementById('downloadBtn');
downloadBtn.addEventListener('click', downloadBestSmileImage);

// * Main handler code chunk

let faceapiInterval;
let bestSmileFrame = null;
let bestSmileScore = -1;
const fps = 3;


// * Getting the best saved frame from the localStorage if it's available

// let savedBestFrame = localStorage.getItem('bestFrame');

// if (savedBestFrame){
//   bestSmileScore = JSON.parse(savedBestFrame)['smile_score'];
//   bestSmileFrame = JSON.parse(savedBestFrame)['smile_frame'];
//   console.log('Best frame found with score: ', bestSmileScore);
// }
// else console.log('Best frame not found!');


document.getElementById('startBtn').addEventListener('click', () => {

  const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight }

  // ! Hidden canvas changes and drawings: [Might restore later] 
  const canvas = faceapi.createCanvasFromMedia(videoElement)
  canvas.id = 'canvas';
  document.getElementById('video-container').replaceChild(canvas, document.getElementById('canvas'));
  faceapi.matchDimensions(canvas, displaySize)
  canvas.hidden=false;

  faceapiInterval = setInterval(async () => {
    const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
    const resizedDetections = await faceapi.resizeResults(detections, displaySize)
    const expressions = detections[0]['expressions'];
    const emotionsMap = new Map(Object.entries(expressions));
    const emotionScores = Array.from(emotionsMap.values());  

    updateScores(emotionScores);
    updateLineChart(emotionsMap.get('happy'));

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    const emoji = getEmojiFromScore(expressions);
    // get a reference to the emoji container div
    const emojiContainer = document.getElementById('emoji-container');
    // set the innerHTML of the container to the emoji
    emojiContainer.innerHTML = emoji;

    // let smile_score = emotionsMap.get('happy') 
    //                     - 10 * (emotionsMap.get('neutral')) 
    //                     - 10000 * (emotionsMap.get('sad') + emotionsMap.get('angry') + emotionsMap.get('surprised') + emotionsMap.get('disgusted') + emotionsMap.get('fearful'))
    //                     - 0.1 * (maxDeviationRight-maxDeviationRight)
    //                     + 0.00001 * (maxDeviationLeft)
    //                     + 0.00001 * (maxDeviationRight)
    //                     + 0.0001 * (mouthOpen);

    let smile_score = 0.8 * emotionsMap.get('happy')
                      // + 0.1 * (emotionsMap.get('neutral')) 
                      // - 10000 * (emotionsMap.get('sad') + emotionsMap.get('angry') + emotionsMap.get('surprised') + emotionsMap.get('disgusted') + emotionsMap.get('fearful'))
                      // - 0.05 * (maxDeviationRight-maxDeviationRight)
                      + 0.1 * (maxDeviationLeft/maxAngleLeft)
                      + 0.1 * (maxDeviationRight/maxAngleRight)
                      // + 0.0001 * (mouthOpen);


    smile_score = smile_score < 0 ? 0 : smile_score;
    smile_score = Math.round(smile_score * 1000) / 1000;
    
    advice = evaluateSmile(resizedDetections[0]['landmarks']['_positions']);
    
    const cheeksAdvice = document.getElementById('advice-cheeks');
    const mouthAdvice = document.getElementById('advice-mouth');
    const faceAdvice = document.getElementById('advice-face');

    cheeksAdvice.innerHTML = advice['cheeks'];
    mouthAdvice.innerHTML = advice['mouth'];
    faceAdvice.innerHTML = advice['face_position'];

    const scoreElement = document.getElementById('score-container');

    scoreElement.innerHTML = smile_score;

    // * Best smile score and frame tracking

    if (smile_score > bestSmileScore){
      bestSmileFrame = captureFrame(videoElement);
      bestSmileScore = smile_score;
    }

    // console.log("Smile Score: ", smile_score)
    // console.log('__________________________________________________________________________');

  }, 1000/fps)

  
  downloadBtn.hidden = true;
  document.getElementById('resetBtn').hidden = false;
  document.getElementById('startBtn').hidden = true;

})

document.getElementById('resetBtn').addEventListener('click', ()=>{
  // document.getElementById('canvas').getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  document.getElementById('resetBtn').hidden = true;
  document.getElementById('startBtn').hidden = false;
  document.getElementById('canvas').hidden = true;
  clearInterval(faceapiInterval);
  

  // * Save the best frame to local storage

  date = new Date();

  const bestFrameMap = new Map();
  bestFrameMap.set('smile_score', bestSmileScore);
  bestFrameMap.set('smile_frame', bestSmileFrame);
  bestFrameMap.set('timestamp', date.toJSON().slice(0, 10));

  console.log(bestFrameMap)

  const bestFrameJSON = JSON.stringify(Array.from(bestFrameMap.entries()));
  localStorage.setItem('bestFrame', bestFrameJSON);

  console.log(bestFrameJSON)



  console.log('Best Smile Score', bestSmileScore, 'Best Smile Frame', bestSmileFrame);
  bestSmileScore = 0;
  bestSmileFrame = null;
  downloadBtn.hidden = false;

})



// * Dominant Mood Handler

// Function that returns the emoji based on the dominant emotion score:
function getEmojiFromScore(scores) {
  const dominantEmotion = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  switch (dominantEmotion) {
    case 'happy':
      // return '😊';
      return '😁';
    case 'angry':
      return '😠';
    case 'sad':
      return '😢';
    case 'fearful':
      return '😨';
    case 'disgust':
      return '😩';
    case 'surprised':
      return '😲';
    case 'neutral':
      return '🙂';
    // and so on
    default:
      return '🙂'; // a neutral emoji in case the dominant emotion is not recognized
  }
}

// * Smile Rules Formulation

// Function to calculate the Euclidean distance between two points
function calculateDistance(point1, point2) {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Function to calculate the angle between two points
function calculateAngle(point1, point2) {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  return angle;
}

// Function to calculate the vertical distance between two points
function calculateVerticalDistance(point1, point2) {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  const distance = Math.abs(y2 - y1);
  return distance;
}

// Function to calculate the horizontal distance between two points
function calculateHorizontalDistance(point1, point2) {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  const distance = Math.abs(x2 - x1);
  return distance;
}

 /*
  Calculates the angle ABC (in radians) 
 
  A first point, ex: {x: 0, y: 0}
  C second point
  B center point
 */
 function find_angle(A,B,C) {
  A = {x: A[0], y: A[1]};
  B = {x: B[0], y: B[1]};
  C = {x: C[0], y: C[1]};

  var AB = Math.sqrt(Math.pow(B.x-A.x,2)+ Math.pow(B.y-A.y,2));    
  var BC = Math.sqrt(Math.pow(B.x-C.x,2)+ Math.pow(B.y-C.y,2)); 
  var AC = Math.sqrt(Math.pow(C.x-A.x,2)+ Math.pow(C.y-A.y,2));
  return Math.acos((BC*BC+AB*AB-AC*AC)/(2*BC*AB)) * (180 / Math.PI);
}

// Global vars to be used for smile advice 
var maxAngleLeft = 0;
var maxAngleRight = 0;
var minAngleLeft = 180;
var minAngleRight = 180;
var mouthOpen = 0;
var maxDeviationLeft;
var maxDeviationRight;

// Function to evaluate the user's smile based on the detected landmarks
function evaluateSmile(landmarks) {

  // To hold the smile advice 
  advice = {'cheeks': '', 'face_position': '', 'mouth': ''};

  // Required landmarks
  const rightLipCorner = [landmarks[48]['x'], landmarks[48]['y']];
  const leftLipCorner = [landmarks[54]['x'], landmarks[54]['y']];
  const middlePoint = [landmarks[57]['x'], landmarks[57]['y']];
  const noseCenter = [landmarks[30]['x'], landmarks[30]['y']];
  const rightEyeCenter = [landmarks[36]['x'], landmarks[36]['y']];
  const leftEyeCenter = [landmarks[45]['x'], landmarks[45]['y']];
  const rightJawline = [landmarks[3]['x'], landmarks[3]['y']];
  const leftJawline = [landmarks[13]['x'], landmarks[13]['y']];
  const topLipBottom = [landmarks[62]['x'], landmarks[62]['y']];
  const bottomLipTop = [landmarks[66]['x'], landmarks[66]['y']];



  // * Cheek 

  // Calculate the angle between right lip corner, nose center, and right eye center
  var rightAngle = find_angle(rightLipCorner, noseCenter, rightEyeCenter);

  // Calculate the angle between left lip corner, nose center, and left eye center
  var leftAngle = find_angle(leftLipCorner, noseCenter, leftEyeCenter);

  // Calculate the difference between the two angles
  const angleDifference = Math.abs(rightAngle - leftAngle);

  maxAngleLeft = Math.max(maxAngleLeft, leftAngle);
  minAngleLeft = Math.min(minAngleLeft, leftAngle);
  maxAngleRight = Math.max(maxAngleRight, rightAngle);
  minAngleRight = Math.min(minAngleRight, rightAngle);

  maxDeviationLeft = Math.abs(maxAngleLeft-minAngleLeft);
  maxDeviationRight = Math.abs(maxAngleRight-minAngleRight);

  const currDeviationLeft = Math.abs(maxAngleLeft - leftAngle);
  const currDeviationRight = Math.abs(maxAngleRight - rightAngle);
  const deviationThreshold = 10;

  // // English　Advice
  // if (currDeviationLeft - currDeviationRight > deviationThreshold) {
  //   advice['cheeks'] = '🙂👉Left cheek is lifted more than right cheek';
  //   // console.log('Left cheek is lifted more than right cheek');
  // }
  // else if (currDeviationRight - currDeviationLeft > deviationThreshold) {
  //   advice['cheeks'] = '👈🙂Right cheek is lifted more than left cheek';
  //   // console.log('Right cheek is lifted more than left cheek');
  // }
  // else {
  //   advice['cheeks'] = '😁👌Both cheeks are lifted symmetrically :)';
  //   // console.log('Both cheeks are lifted');
  // }

  // Japanese Advice
  if (currDeviationLeft - currDeviationRight > deviationThreshold) {
    advice['cheeks'] = '🙂👉左頬が右頬よりも上がっています。';
    // console.log('Left cheek is lifted more than right cheek');
  }
  else if (currDeviationRight - currDeviationLeft > deviationThreshold) {
    advice['cheeks'] = '👈🙂右頬が左頬よりも上がっています。';
    // console.log('Right cheek is lifted more than left cheek');
  }
  else {
    advice['cheeks'] = '😁👌 完璧です！両頬が対照的になっています。:)';
    // console.log('Both cheeks are lifted');
  }

  // console.log('Left Angle:', leftAngle, 'Right Angle:', rightAngle);
  // console.log("Angle difference between right and left:", angleDifference);
  // console.log("Maximum Deviation: ", maxDeviationLeft, maxDeviationRight);

  // * Rule : Lips

  distanceLeftLipCorner = calculateDistance(leftLipCorner, middlePoint);
  distanceRightLipCorner = calculateDistance(rightLipCorner, middlePoint);

  // console.log("Lip distance: ", distanceLeftLipCorner, distanceRightLipCorner);


  // * Rule: Mouth

  mouthOpen = calculateDistance(topLipBottom, bottomLipTop);
  const mouthThresholdMin = 5;
  const mouthThresholdMax = 20;

  // console.log("Mouth open:", mouthOpen);

  // if (mouthThresholdMax > mouthOpen && mouthOpen > mouthThresholdMin){
  //   advice['mouth'] = '😄👌  Perfect mouth positioning! :)';
  // }
  // else if (mouthOpen >= mouthThresholdMax){
  //   advice['mouth'] = ' 😮->😄Try smiling with your mouth little closed';
  // }
  // else if (mouthOpen <= mouthThresholdMin){
  //   advice['mouth'] = '🙂->😄Try smiling with your mouth open';
  // }

  
  if (mouthThresholdMax > mouthOpen && mouthOpen > mouthThresholdMin){
    advice['mouth'] = '😄👌  口の位置も完璧！ :)';
  }
  else if (mouthOpen >= mouthThresholdMax){
    advice['mouth'] = ' 😮->😄口を少し閉じて笑ってみてください。';
  }
  else if (mouthOpen <= mouthThresholdMin){
    advice['mouth'] = '🙂->😄口を開けて笑ってみてください。';
  }
  
  // * Rule: Face position

  // Calculate distances between lip corners and jawlines
  const leftDistance = calculateDistance(leftLipCorner, leftJawline);
  const rightDistance = calculateDistance(rightLipCorner, rightJawline);

  // console.log("Difference between left and right jawline:", leftDistance-rightDistance);

  // Set a threshold for suggesting the user to look more left or right
  const lookThreshold = 10; // Adjust as per your requirement

  // // Determine the suggested look direction
  // if (leftDistance - rightDistance >= lookThreshold) {
  //   advice['face_position'] = '👀👈  Look more left';
  //   // console.log('Look more right');
  // } else if (rightDistance - leftDistance >= lookThreshold) {
  //   advice['face_position'] = '👀👉  Look more right';
  //   // console.log('Look more left');
  // } else {
  //   advice['face_position'] = '😊👌  Perfect shape! Keep the gaze :)';
  //   // console.log('Keep the gaze');
  // }

  // Japanese Advice
  if (leftDistance - rightDistance >= lookThreshold) {
    advice['face_position'] = '👀👈 もっと左を見てください。';
    // console.log('Look more right');
  } else if (rightDistance - leftDistance >= lookThreshold) {
    advice['face_position'] = '👀👉  もっと右を見てください。';
    // console.log('Look more left');
  } else {
    advice['face_position'] = '😊👌 完璧な角度です！:)';
    // console.log('Keep the gaze');
  }
  
  // console.log(advice);
  
  return advice;
 
  // Rule: Angle of lip corners with the horizon
  const angle = calculateAngle(leftLipCorner, rightLipCorner);
  // console.log("Angle of lip corners with the horizon:", angle);

  // Rule: Angle of left lip corner with the horizon
  const leftLipCornerAngle = calculateAngle(leftLipCorner, [leftLipCorner[0], landmarks[33]['y']]);
  // console.log("Angle of left lip corner with the horizon:", leftLipCornerAngle);

  // Rule: Angle of right lip corner with the horizon
  const rightLipCornerAngle = calculateAngle(rightLipCorner, [rightLipCorner[0], landmarks[33]['y']]);
  // console.log("Angle of right lip corner with the horizon:", rightLipCornerAngle);
  
  // Rule: Distance between lip corners
  const distanceBetweenCorners = Math.sqrt(Math.pow(rightLipCorner[0] - leftLipCorner[0], 2) + Math.pow(rightLipCorner[1] - leftLipCorner[1], 2));
  // console.log("Distance between lip corners:", distanceBetweenCorners);

  // Calculate the horizontal distance between each lip corner and the middle point
  const distanceHorizontalLeft = calculateHorizontalDistance(leftLipCorner, middlePoint);
  const distanceHorizontalRight = calculateHorizontalDistance(rightLipCorner, middlePoint);
  // console.log("Horizontal distance difference", Math.abs(distanceHorizontalLeft-distanceHorizontalRight));

  // Calculate the vertical distance between each lip corner and the middle point
  const distanceVerticalLeft = calculateVerticalDistance(leftLipCorner, middlePoint);
  const distanceVerticalRight = calculateVerticalDistance(rightLipCorner, middlePoint);
  // console.log("Vertical distance difference", Math.abs(distanceVerticalLeft-distanceVerticalRight));

}



// *PLOTLY JS All Emotions Chart

// Set up the initial data for the plot
// const initialData = [
//   { emotion: 'neutral', score: 0 },
//   { emotion: 'happy', score: 0 },
//   { emotion: 'sad', score: 0 },
//   { emotion: 'angry', score: 0 },
//   { emotion: 'fearful', score: 0 },
//   { emotion: 'disugsted', score: 0 },
//   { emotion: 'surprised', score: 0 }
// ];

const initialData = [
  { emotion: '中性', score: 0 },
  { emotion: '幸福度', score: 0 },
  { emotion: '悲しみ', score: 0 },
  { emotion: '怒り', score: 0 },
  { emotion: '恐怖心', score: 0 },
  { emotion: '嫌悪感', score: 0 },
  { emotion: '驚き', score: 0 }
];

// Create an array to hold the current scores
let scores = [...initialData];

// Create an array to hold the X-axis labels
const xLabels = scores.map(data => data.emotion);

// Create an array to hold the Y-axis values
const yValues = scores.map(data => data.score);

const colors = ['blue', 'green', 'red', 'orange', 'purple', 'yellow', 'cyan'];

// Set up the plot layout
const layout = {
  // title: 'Real-time Emotion Scores',
  title: 'リアルタイムの感情スコア',
  xaxis: {
    title: '感情',
    tickangle: -45
  },
  yaxis: {
    title: 'スコア',
    range: [0, 1]
  },
  font:{
    size: 8
  },
  height: 280,
};

// Create the plot with initial data and layout
const allEmotionsChartContainer = document.getElementById('allEmotionsChartContainer');

const allEmotionsPlot = Plotly.newPlot(allEmotionsChartContainer, [{
  x: xLabels,
  y: yValues,
  type: 'bar',
  marker: {
    color: colors
  }
}], layout);

// Function to update the scores and redraw the plot
function updateScores(scoreArray) {
  // Simulate the update of the scores every 100ms
  scores = scores.map((data, index) => ({
    emotion: data.emotion,
    score: scoreArray[index]
  }));

  // Update the Y-axis values
  const updatedYValues = scores.map(data => data.score);

  // Restyle the plot with the updated scores
  Plotly.restyle(allEmotionsChartContainer, 'y', [updatedYValues]);
}


// *PLOTLY JS Happiness Chart

// Set up initial data for line chart
const initialLineData = {
  x: [],
  y: [],
  mode: 'lines',
  line: { color: 'blue' }
};

// Create an array to hold the traces for both the bar and line chart
var traces = [{
  x: [],
  y: [],
  type: 'bar',
  marker: {
    color: colors
  }
}, initialLineData];

// Create an array to hold the line chart traces
const lineData = [initialLineData];

// Set up the plot layout
const lineLayout = {
  // title: 'Real-time Happiness Status',
  title: 'リアルタイムの幸福度ステータス',
  xaxis: {
    showticklabels: false,
    // type: 'date',
    // title: 'Time',
    // tickformat: '%H:%M:%S', 
    // showgrid: false
    visible: false,
  },
  yaxis: {
    // title: 'Happiness Score',
    title: 'ハピネススコア',
    range: [0, 1]
  },
  font:{
    size: 8
  },
  hovermode: 'y',
  hovertemplate: '%{y}',
  height: 280,
};

const happyChartContainer = document.getElementById('happyChartContainer');

// Create the plot with the bar and line chart traces
const happyPlot = Plotly.newPlot(happyChartContainer, [traces[0], initialLineData], lineLayout);

// Function to update the line chart with new happiness scores
function updateLineChart(happinessScore) {
  const currentTime = new Date();
  const timestamp = currentTime.getTime(); // Get the timestamp in milliseconds

  // Add the new data point to the line chart traces
  lineData[0].x.push(timestamp);
  lineData[0].y.push(happinessScore);

  // Update the line chart with the new data
  Plotly.update(happyChartContainer, lineData, lineLayout);
}

// * Utility functions

function eucleanDist(a, b) {
  return Math.sqrt(Math.pow(a['x'] - b['x'], 2) + Math.pow(a['y'] - b['y'], 2));
}

async function normalizeArray(arr) {
  const minValue = Math.min(...arr);
  const maxValue = Math.max(...arr);
  const normalizedArray = arr.map(value => (value - minValue) / (maxValue - minValue));
  return normalizedArray;
}

async function softmax(arr) {
  const expValues = arr.map(value => Math.exp(value));
  const sumExpValues = expValues.reduce((acc, value) => acc + value, 0);
  const softmaxValues = expValues.map(value => value / sumExpValues);
  return softmaxValues;
}


// Assuming you have a Plotly graph object assigned to the variable `graph`

function resizeGraph() {
  var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  var graphHeight;

  if (windowWidth > 1000) {
    graphHeight = 600; // Set the desired width for resolutions greater than 1000

  } else {
    graphHeight = 250; // Set the desired width for resolutions less than or equal to 1000
  }

  Plotly.relayout(happyPlot, {
    height: graphHeight,
    font:{
      size: 10,
    }
  });

  Plotly.relayout(allEmotionsPlot, {
    height: graphHeight,
    font:{
      size: 10,
    }
  });

}

// // Initial resize on page load
// window.addEventListener('load', resizeGraph);

// // Resize graph on window resize
// window.addEventListener('resize', resizeGraph);

document.addEventListener('DOMContentLoaded', function() {
  const scriptContainer = document.getElementById('script-container');

  scriptContainer.addEventListener('click', function() {
    scriptContainer.contentEditable = true;
    scriptContainer.focus();
  });

  scriptContainer.addEventListener('blur', function() {
    scriptContainer.contentEditable = false;
  });
});

// * Speech Analysis Module

// let recognizer;

// function predictWord() {
//  // Array of words that the recognizer is trained to recognize.
//  const words = recognizer.wordLabels();
//  recognizer.listen(({scores}) => {
//    // Turn scores into a list of (score,word) pairs.
//    scores = Array.from(scores).map((s, i) => ({score: s, word: words[i]}));
//    // Find the most probable word.
//    scores.sort((s1, s2) => s2.score - s1.score);
//   //  document.querySelector('#console').textContent = scores[0].word;
//    console.log(scores[0].word);
//  }, {probabilityThreshold: 0.75});
// }

// async function app() {
//  recognizer = speechCommands.create('BROWSER_FFT');
//  await recognizer.ensureModelLoaded();
//  predictWord();
// }

// app();