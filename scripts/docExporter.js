const fs = require("fs")
const path = require("path")

const getAllFiles = function(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      let filename = path.parse(file);
      if(file === "readme.md") {
        arrayOfFiles.push(path.join( dirPath, "/", file))
      }
    }
  })

  return arrayOfFiles
}

const collectFiles = function(filePath) {
    let parent = path.basename(path.dirname(filePath));
    let target = path.join(docTargetPath, parent+".md");
    // File destination.txt will be created or overwritten by default.
    fs.copyFile(filePath, target, (err) => {
      if (err) throw err;
    });
}
const docTargetPath = process.argv[2];
getAllFiles("./src/components/").map( file => collectFiles(file));
