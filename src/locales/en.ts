export const en = {
  // Site Info
  siteName: 'FileMend.com',
  siteDescription: 'Securely process your PDF, audio and image files in your browser. Your files are never uploaded to our servers.',
  
  // Navigation
  nav: {
    home: 'Home',
    pdfTools: 'PDF Tools',
    audioTools: 'Audio Tools',
    imageTools: 'Image Tools',
    pdfEdit: 'PDF Edit',
    pdfSplit: 'PDF Split',
    pdfCompress: 'PDF Compress',
    pdfRotate: 'PDF Rotate',
    audioConvert: 'Audio Convert',
    audioTrim: 'Audio Trim',
    audioMerge: 'Audio Merge',
    imageCompress: 'Image Compress',
    imageConvert: 'Image Convert',
    imageResize: 'Image Resize',
    imageRotate: 'Image Rotate',
  },
  
  // Common Messages
  messages: {
    error: 'Error',
    success: 'Success',
    pleaseUpload: 'Please upload',
    fileUpload: 'file',
    pdfFile: 'a PDF',
    audioFile: 'an audio',
    imageFile: 'an image',
    filesUpload: 'files',
    audioFiles: 'audio files',
    pdfFiles: 'PDF files',
    processingError: 'operation failed.',
    ffmpegError: 'An error occurred while loading FFmpeg.',
    pageError: 'PDF page count could not be retrieved.',
    rangeError: 'Enter valid page ranges.',
    minPageError: 'At least one page is required.',
    minFilesError: 'At least 2',
    fileSelect: 'files must be selected.',
    fileLoaded: 'files loaded.',
    fileCompressed: 'file successfully compressed.',
    fileExported: 'successfully exported.',
    fileMerged: 'files successfully merged.',
    fileConverted: 'file successfully converted.',
    fileRotated: 'file successfully rotated.',
    fileTrimmed: 'file successfully trimmed.',
    fileResized: 'file successfully resized.',
    fileSplit: 'PDF split operation failed.',
    loadError: 'Error while loading.',
    exportError: 'Error while exporting.',
    pdfLoadError: 'PDF Load Error',
    exportPdfError: 'Export Error',
  },
  
  // FileDropzone
  dropzone: {
    dragText: 'Drop files here',
    dropTextActive: 'Drag files here or click to select',
    multipleFiles: 'You can select multiple files',
    singleFile: 'Select a single file',
    maxFiles: '(max {count})',
    filesSelected: '{count} files selected',
    clear: 'Clear',
    fileSize: '{size} MB',
  },
  
  // PDF Edit Specific
  pdfEdit: {
    title: 'PDF Edit',
    description: 'View, merge, rotate and edit your PDF files.',
    viewMode: {
      files: 'Files',
      pages: 'Pages',
    },
    actions: {
      addFiles: 'Add Files',
      clearAll: 'Clear All',
      undo: 'Undo',
      export: 'Export',
      rotateAll: 'Rotate All',
      sortByName: 'Sort by Name',
      sortBySize: 'Sort by Size',
      sortByPageCount: 'Sort by Page Count',
      sortByFileName: 'Sort by File Name',
      sortByPageNumber: 'Sort by Page Number',
      ascending: 'Ascending',
      descending: 'Descending',
    },
    fileInfo: '{pageCount} p • {size} MB',
    selected: 'Selected',
    noPreview: 'No preview',
    sorted: 'Sorted',
    undoAction: 'Undone',
    addFileCanceled: 'File addition canceled.',
    fileRemoved: 'File deletion canceled.',
    sortingReverted: 'Sorting reverted.',
    rotationCanceled: 'Rotation canceled.',
    pageRemoved: 'Page deletion canceled.',
    pageSortingReverted: 'Page sorting reverted.',
    batchRotationCanceled: 'Batch rotation canceled.',
    fileRotated: 'All pages in file rotated 90°.',
    pageRotated: 'Page rotated 90°.',
    allPagesRotated: 'All pages rotated 90°.',
    download: 'Download',
    addFilesButton: 'Add Files',
    exportButton: 'Export',
    creating: 'PDF creating...',
    sortedByName: 'Files sorted by name {order}.',
    sortedByPageCount: 'Files sorted by page count {order}.',
    sortedBySize: 'Files sorted by size {order}.',
    sortedByPageNumber: 'Pages sorted {order}.',
    sortedByFileName: 'Pages sorted by file name {order}.',
    ascendingOrder: 'A-Z',
    descendingOrder: 'Z-A',
    numericAscending: '1-9',
    numericDescending: '9-1',
    sizeAscending: 'small to large',
    sizeDescending: 'large to small',
    smallToLarge: 'Small to Large',
    largeToSmall: 'Large to Small',
    fileSize: 'File Size',
    pageNumber: 'Page Number',
    fewToMany: 'Few to Many',
    manyToFew: 'Many to Few',
    pageCount: 'Page Count',
    fileName: 'File Name',
    sortByName: 'By Name',
    sort: 'Sort',
    pageView: 'Page View',
    fileView: 'File View',
    page: 'Page',
    of: '/',
    altPage: 'Page',
    pages: 'pages',
    deleteFile: 'Delete File',
    addPdf: 'Add PDF',
    rotateAll: 'Rotate All',
    clear: 'Clear',
  },
  
  // PDF Split Page
  pdfSplit: {
    title: 'Advanced PDF Splitter',
    description: 'Split your PDF file into multiple files with 6 different methods.',
    // Header
    fileName: '{name} • {count} pages',
    bookmarksFound: '({count} bookmarks found)',
    clear: 'Clear',
    download: 'Download',
    downloadWithCount: 'Download ({count})',
    downloadZip: 'Download (ZIP)',
    // Split modes
    modes: {
      range: 'Range',
      visual: 'Visual',
      everyN: 'Every {count} pages',
      bookmarks: 'Bookmark ({count})',
      size: 'Size (~{size}MB)',
      blankPage: 'Blank Page',
      pattern: 'Pattern',
    },
    // Range mode
    rangeMode: {
      placeholder: '1-5, 10, 15-20',
      apply: 'Apply Ranges',
      description: 'Separate ranges with commas. Ex: 1-5, 10, 15-20',
    },
    // Every N mode
    everyNMode: {
      every: 'Every',
      pages: 'pages',
      apply: 'Apply',
    },
    // Size mode
    sizeMode: {
      targetSize: 'Target size:',
      mb: 'MB',
      apply: 'Apply',
    },
    // Bookmark mode
    bookmarkMode: {
      title: 'Split by PDF Bookmarks',
      apply: 'Split by Bookmarks',
      noBookmarks: 'No bookmarks found in this PDF',
      preview: 'Bookmark preview:',
      moreItems: 'more items...',
    },
    // Blank page mode
    blankPageMode: {
      title: 'Split by Blank Pages',
      apply: 'Scan and Split',
      threshold: 'Threshold:',
      thresholdDesc: 'characters or less content = blank page',
      instruction: 'Use blank pages as split points',
    },
    // Pattern mode
    patternMode: {
      title: 'Split by Text Pattern (Regex)',
      apply: 'Apply Pattern',
      placeholder: 'Chapter|Section|Page \\d+|^1\\.\\s',
      description: 'Creates new section when this pattern is found in page content. Supports Regex.',
    },
    // Visual mode
    visualMode: {
      selectAll: 'Select All',
      clear: 'Clear',
      selected: '{count} pages selected',
      createGroup: 'Create Section',
      noSections: 'No sections yet. Select a split method.',
    },
    // Groups section
    groups: {
      title: 'Sections ({count})',
      noGroups: 'No sections yet. Select a split method.',
      unnamedSection: 'Section {count}',
      allPages: 'All Pages',
      pageInfo: '{count} pages • ~{size} MB',
      blankIndicator: '(B)',
      // Split reasons
      splitReasons: {
        manual: 'Manual selection',
        bookmark: 'Bookmark: {title}',
        blankPage: 'After blank page (page {page})',
        pattern: 'Pattern match: page {page}',
        range: 'Manual range: {range}',
        unassigned: 'Unassigned pages',
        lastSection: 'Last section',
      },
    },
    // Messages
    messages: {
      fileLoaded: '{count} pages loaded',
      fileLoadError: 'Error loading PDF',
      pleaseUploadPdf: 'Please upload only PDF files',
      selectPagesFirst: 'Select pages first',
      sectionCreated: '{count} pages added',
      sectionCreatedTitle: 'Section Created',
      sectionsCreated: '{count} sections created',
      splitCompleted: 'Split Completed',
      smartSplitCompleted: 'Smart Split Completed',
      smartSplitDesc: '{count} sections detected. Review and confirm.',
      rangeSplitCompleted: '{count} groups created',
      patternMatches: '{count} matches found, {count} sections created',
      blankPagesFound: '{count} blank pages found, {count} sections created',
      unassignedPages: '{count} pages unassigned, added to "Remaining Pages" group',
      noValidRanges: 'No valid page ranges found',
      noPatternMatches: 'Pattern not found on any page',
      invalidRegex: 'Invalid Regex pattern',
      noPatternProvided: 'Please enter a pattern',
      noRangesProvided: 'Please enter page ranges',
      processingStarted: 'Download started',
      downloadingFiles: 'Downloading {count} files...',
      downloadingZip: 'Downloading {count} files as ZIP...',
      splitError: 'PDF split operation failed',
    },
    // Status messages
    status: {
      automaticModeActive: 'Automatic split mode active. Configure settings above.',
      noBookmarksFound: 'No bookmarks found in this PDF',
      blankPageInstruction: 'Click "Scan and Split" for blank page detection',
      processing: 'Processing PDF...',
      pleaseWait: 'Please wait, splitting pages...',
    },
    // Privacy
    privacy: {
      title: 'Privacy Guarantee',
      description: 'All operations are performed in your browser',
      points: [
        'All operations are performed in your browser',
        'No files are sent to the server',
        'PDF bookmark and content analysis is done locally',
      ],
      badge: 'Secure: Your files are processed on your device',
    },
    // Preview modal
    preview: {
      close: 'Close',
    },
    // Loading
    loading: {
      label: 'Processing PDF...',
    },
  },
  
  // PDF Compress Page
  pdfCompress: {
    title: 'PDF Compress',
    description: 'Reduce the size of your PDF file.',
    compress: 'Compress',
    originalSize: 'Original Size',
    compressedSize: 'Compressed Size',
    compressionRatio: 'Compression Ratio',
    compressionCompleted: 'Compression Completed!',
    compressing: 'Compressing...',
    processing: 'Processing...',
    downloadAgain: 'Download Again',
    reducedBy: 'reduced by %{ratio}%',
    pdfPrefix: 'PDF ',
  },
  
  // PDF Rotate Page
  pdfRotate: {
    title: 'PDF Rotate',
    description: 'Rotate your PDF pages.',
    rotate: 'Rotate',
    rotation: 'Rotation',
    clockwise: 'Clockwise',
    counterClockwise: 'Counter-Clockwise',
    degrees: 'Degrees',
    rotationAngle: 'Rotation Angle',
    rotating: 'Rotating...',
    processing: 'Processing...',
    rotateAndDownload: 'Rotate and Download PDF',
    clockwise90: '90° Clockwise',
    degrees180: '180°',
    counterClockwise90: '90° Counter-Clockwise',
  },
  
  // Audio Convert Page
  audioConvert: {
    title: 'Audio Convert',
    description: 'Convert your audio files to different formats.',
    convert: 'Convert',
    outputFormat: 'Output Format',
    originalFormat: 'Original Format',
    convertedFormat: 'Converted Format',
    loadingLibrary: 'Loading audio processing library... Please wait.',
    selectFormat: 'Select format',
    loading: 'Loading...',
    converting: 'Converting...',
    processing: 'Processing...',
    convertAndDownload: 'Convert and Download Audio',
    audioPrefix: 'Audio ',
  },
  
  // Audio Trim Page
  audioTrim: {
    title: 'Audio Trim',
    description: 'Cut the desired part from your audio file.',
    trim: 'Trim',
    startTime: 'Start Time',
    endTime: 'End Time',
    duration: 'Duration',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    loadingLibrary: 'Loading audio processing library... Please wait.',
    selectedDuration: 'Selected Duration:',
    preview: 'Preview',
    processing: 'Processing...',
    trimAndDownload: 'Trim and Download',
    loading: 'Loading...',
    trimming: 'Trimming...',
    fileTrimmed: 'Audio file successfully trimmed.',
    trimError: 'Audio trimming operation failed.',
  },
  
  // Audio Merge Page
  audioMerge: {
    title: 'Audio Merge',
    description: 'Merge multiple audio files into one.',
    merge: 'Merge',
    addFiles: 'Add Files',
    dragToReorder: 'Drag to reorder',
    loadingLibrary: 'Loading audio processing library... Please wait.',
    sorting: 'Sorting',
    filesCount: '{count} files',
    processing: 'Processing...',
    mergeAndDownload: 'Merge and Download Audio',
    loading: 'Loading...',
    merging: 'Merging...',
    filesMerged: 'Audio files successfully merged.',
    mergeError: 'Audio merging operation failed.',
    minFilesError: 'You must select at least 2 audio files.',
  },
  
  // Image Compress Page
  imageCompress: {
    title: 'Image Compress',
    description: 'Reduce the size of your image files while maintaining quality.',
    compress: 'Compress',
    quality: 'Quality',
    originalSize: 'Original Size',
    compressedSize: 'Compressed Size',
    compressionRatio: 'Compression Ratio',
    original: 'Original',
    compressed: 'Compressed',
    notCompressedYet: 'Not compressed yet',
    qualityLabel: 'Quality: %{quality}',
    lowQualityNote: 'Lower quality = smaller file size',
    compressing: 'Compressing...',
    processing: 'Processing...',
    compressAndDownload: 'Compress Image',
    compressAgainAndDownload: 'Compress Again and Download',
    imagePrefix: 'Image ',
    reducedBy: 'reduced by %{ratio}%',
  },
  
  // Image Convert Page
  imageConvert: {
    title: 'Image Convert',
    description: 'Convert your image files to different formats.',
    convert: 'Convert',
    outputFormat: 'Output Format',
    originalFormat: 'Original Format',
    convertedFormat: 'Converted Format',
    preview: 'Preview',
    selectFormat: 'Select format',
    converting: 'Converting...',
    processing: 'Processing...',
    convertAndDownload: 'Convert and Download Image',
    imageConverted: 'Image successfully converted.',
    convertError: 'Image conversion operation failed.',
    imagePrefix: 'Image ',
  },
  
  // Image Resize Page
  imageResize: {
    title: 'Image Resize',
    description: 'Change the size of your image files.',
    resize: 'Resize',
    width: 'Width',
    height: 'Height',
    maintainAspectRatio: 'Maintain Aspect Ratio',
    originalSize: 'Original Size',
    newSize: 'New Size',
    pixels: 'pixels',
    resizing: 'Resizing...',
    processing: 'Processing...',
    resizeAndDownload: 'Resize and Download',
    imageResized: 'Image successfully resized.',
    resizeError: 'Image resize operation failed.',
    imagePrefix: 'Image ',
  },
  
  // Image Rotate Page
  imageRotate: {
    title: 'Image Rotate',
    description: 'Rotate your images at your desired angle.',
    rotate: 'Rotate',
    rotation: 'Rotation',
    clockwise: 'Clockwise',
    counterClockwise: 'Counter-Clockwise',
    degrees: 'Degrees',
    rotationAngle: 'Rotation Angle',
    rotating: 'Rotating...',
    processing: 'Processing...',
    rotateAndDownload: 'Rotate and Download Image',
    imageRotated: 'Image successfully rotated.',
    rotateError: 'Image rotation operation failed.',
    imagePrefix: 'Image ',
    clockwise90: '90° Clockwise',
    degrees180: '180°',
    counterClockwise90: '90° Counter-Clockwise',
  },
  
  // Home Page
  home: {
    hero: {
      badge: '100% Browser Based',
      title: 'Process Your Files',
      titleHighlight: 'Securely',
      description: 'Easily process your PDF, audio and image files in your browser. Your files are never uploaded to our servers.',
      primaryButton: 'PDF Edit',
      secondaryButton: 'Audio Tools',
    },
    pdfTools: {
      title: 'PDF Tools',
      description: 'Easily manage your PDF files',
      edit: {
        title: 'PDF Edit',
        description: 'View, merge, rotate and edit your PDF files.',
      },
      split: {
        title: 'PDF Split',
        description: 'Split your PDF file into multiple files.',
      },
      compress: {
        title: 'PDF Compress',
        description: 'Reduce the size of your PDF file.',
      },
    },
    audioTools: {
      title: 'Audio Tools',
      description: 'Convert and edit your audio files',
      convert: {
        title: 'Audio Convert',
        description: 'Convert your audio files to different formats.',
      },
      trim: {
        title: 'Audio Trim',
        description: 'Cut the desired part from your audio file.',
      },
      merge: {
        title: 'Audio Merge',
        description: 'Merge multiple audio files into one.',
      },
    },
    imageTools: {
      title: 'Image Tools',
      description: 'Optimize your image files',
      compress: {
        title: 'Image Compress',
        description: 'Reduce the size of your image files.',
      },
      convert: {
        title: 'Image Convert',
        description: 'Convert your image files to different formats.',
      },
      resize: {
        title: 'Image Resize',
        description: 'Change the size of your image files.',
      },
      rotate: {
        title: 'Image Rotate',
        description: 'Rotate your images.',
      },
    },
    features: {
      title: 'Why FileMend.com?',
      subtitle: 'Securely process your files with modern web technologies',
      secure: {
        title: 'Secure Processing',
        description: 'All operations are performed in your browser. Your files are never uploaded to our servers.',
      },
      fast: {
        title: 'Fast and Efficient',
        description: 'Your files are processed quickly with modern web technologies.',
      },
      private: {
        title: 'Privacy Focused',
        description: 'Your files stay only on your device. No data is stored.',
      },
    },
  },
  
  // Footer
  footer: {
    brand: {
      title: 'FileMend.com',
      description: 'Securely process your PDF, audio and image files in your browser. Your files are never uploaded to our servers.',
    },
    quickLinks: {
      title: 'Quick Links',
      pdfMerge: 'PDF Merge',
      audioConvert: 'Audio Convert',
      imageCompress: 'Image Compress',
    },
    features: {
      title: 'Features',
      browserBased: '100% Browser Based',
      privacyFocused: 'Privacy Focused',
      freeUsage: 'Free Usage',
      mobileFriendly: 'Mobile Friendly',
    },
    copyright: '© 2024 FileMend.com. All rights reserved.',
    madeWith: 'Made with',
    forYou: 'for you',
  },
  
  // Common UI Elements
  ui: {
    page: 'page',
    pages: 'pages',
    files: 'files',
    files_plural: 'files',
    file: 'file',
    noPreview: 'No preview',
    selected: 'Selected',
    undo: 'Undo',
    loading: 'loading...',
    processing: 'Processing...',
    fileSize: 'File Size',
    fileName: 'File Name',
    pageCount: 'Page Count',
    pageRanges: 'Page Ranges',
    addRange: 'Add Range',
    start: 'Start',
    end: 'End',
    rotationAngle: 'Rotation Angle',
    sortBy: 'Sort (Drag and drop to reorder)',
    dragToReorder: 'Drag and drop to reorder',
    pagesText: 'Drag and drop pages to reorder',
    pdfLoading: 'PDF loading...',
    pageText: 'Page',
    filesText: 'Files',
    viewMode: {
      files: 'Files',
      pages: 'Pages',
    },
  },
  
  // PDF Merge Page
  pdfMerge: {
    title: 'PDF Merge',
    description: 'Merge multiple PDF files into a single file.',
    sorting: 'Sorting (Drag and drop to reorder)',
    filesCount: '{count} files',
    merging: 'Merging...',
    processing: 'Processing...',
    mergeAndDownload: 'Merge and Download PDF',
    filesMerged: 'PDF files successfully merged.',
    mergeError: 'PDF merge operation failed.',
    minFilesError: 'You must select at least 2 PDF files.',
    onlyPdfFiles: 'Please upload only PDF files.',
  },
  
  // Additional UI Elements
  additional: {
    // File operations
    fileCreated: 'file created.',
    fileSplitError: 'PDF split operation failed.',
    fileRotateError: 'PDF rotate operation failed.',
    fileMergeError: 'PDF merge operation failed.',
    audioProcessError: 'Audio merge operation failed.',
    audioTrimError: 'Audio trim operation failed.',
    imageRotateError: 'Image rotate operation failed.',
    imageResizeError: 'Image resize operation failed.',
    imageConvertError: 'Image convert operation failed.',
    
    // Progress states
    audioProcessing: 'Audio processing library loading... Please wait.',
    audioLoading: 'Loading...',
    audioMerging: 'Merging...',
    audioTrimming: 'Trimming...',
    audioConverting: 'Converting...',
    
    // File descriptions
    pageCount: '{count} pages',
    audioLibraryLoading: 'Audio processing library loading... Please wait.',
    imageDescription: 'Reduce the size of your image files while preserving quality.',
    
    // Modal and dialog text
    pageModalTitle: 'Page {current} / {total}',
    pageAltText: 'Page {number}',
    fileModalTitle: '{name} ({count} pages)',
    
    // Button labels
    rotateAll: 'Rotate All',
    clearAll: 'Clear All',
    pageView: 'Page View',
    
    // Sorting labels
    sortByPageCount: 'Page Count',
    sortByPageNumber: 'Page Number',
    
    // Descriptions
    pdfRotateDescription: 'Rotate your PDF pages at your desired angle.',
    audioConvertDescription: 'Convert your audio files to different formats.',
    imageResizeDescription: 'Change the size of your image files.',
    imageConvertDescription: 'Convert your image files to different formats.',
    
    // File labels
    rotatedFile: 'rotated.pdf',
    mergedFile: 'merged.pdf',
    
    // Comments
    loadingLibrary: 'Loading...',
    processingFile: 'Processing...',
  },
  
  // Language
  language: {
    select: 'Select Language',
    turkish: 'Türkçe',
    english: 'English',
    portuguese: 'Português',
    flags: {
      tr: '🇹🇷',
      en: '🇬🇧',
      pt: '🇵🇹',
    },
  },
};
