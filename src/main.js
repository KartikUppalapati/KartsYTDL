const { app, BrowserWindow, dialog, globalShortcut } = require('electron');
const { exec, spawn } = require('node:child_process');
var ipc = require('electron').ipcMain;
const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: 
    {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: !app.isPackaged,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setResizable(false);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Disable reload
app.on('browser-window-focus', function ()
{
  globalShortcut.register("CommandOrControl+R", () =>
  {
    console.log("CommandOrControl+R is pressed: Shortcut Disabled");
  });
  globalShortcut.register("F5", () =>
  {
    console.log("F5 is pressed: Shortcut Disabled");
  });
});
app.on('browser-window-blur', function ()
{
  globalShortcut.unregister('CommandOrControl+R');
  globalShortcut.unregister('F5');
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


// API functions for index.html
ipc.on("openFolderDialog", function(event, data)
{
  // Open system file system and let user choose folder
  var folderPath = dialog.showOpenDialogSync({properties: ['openDirectory']});

  // Send back chosen folder
  if (folderPath != undefined)
  {
    event.sender.send("openFolderDialogReply", folderPath[0]);
  }
});

ipc.on("getFilesInFolder", function(event, folderFullPath)
{
  // Create list
  const listOfFiles = [];

  // Read files into list
  fs.readdir(folderFullPath, (err, files) =>
  {
    files.forEach(file =>
    {
      if (file != ".DS_Store")
      {
        listOfFiles.push(file);
      }
    });
    
    // Send back list
    event.sender.send("getFilesInFolderReply", listOfFiles);
  });
});

ipc.on("saveSongs", function(event, songFileList)
{
  // Go through song file list
  for (let i = 0; i < songFileList.length; i++)
  {
    // Get song data
    var songData = songFileList[i]

    // Save metadata using jar file
    exec(`java -jar src/mp3Editer.jar "${songData.songFullFileName.replaceAll("&amp;", "&")}" "${songData.songName.replaceAll("&amp;", "&")}" "${songData.artistName.replaceAll("&amp;", "&")}" "${songData.albumName.replaceAll("&amp;", "&")}" ${songData.albumImage.replaceAll("&amp;", "&")}`,
    (error, stdout, stderr) =>
    {
      if (error) 
      {
        // console.error(`saving exec error: ${error}`);
        return;
      }
      // console.log(`saving stdout: ${stdout}`);
      // console.error(`saving stderr: ${stderr}`);

      // Send back list
      event.sender.send('songsSavedSuccessfully', "");
    });
  }
});

ipc.on("downloadYoutubeLink", function(event, youtubeLink, downloadFolder)
{
  // Spawn child process to download songs using yt-dlp
  var commandArray = ["./src/kartsYtdlp", "-i", "--ffmpeg-location", "./src/kartsFfmpeg", "-x", "--audio-format", 
  "mp3", "-o", downloadFolder + "'/%(title)s.%(ext)s'", youtubeLink]
  const downloadInProgress = exec(commandArray.join(" "));

  downloadInProgress.stdout.on('data', (outData) =>
  {
    // console.log(`stdout: ${outData}`);
    event.sender.send('downloadInProgress', outData.toString());
  });
  
  downloadInProgress.stderr.on('data', (errData) =>
  {
    // console.error(`stderr: ${errData}`);
    event.sender.send('downloadInProgress', errData.toString());
  });

  downloadInProgress.on('close', (code) =>
  {
    // Send back successful response if success
    if (code == 0)
    {
      event.sender.send('downloadCompletedSuccessfully', "");
    }
    else
    {
      event.sender.send('downloadCompletedUnsuccessfully', "");
    }
  }); 
});