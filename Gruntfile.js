var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var path = require('path');
var fs = require('fs');

module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    less: {
      production: {
        files: {
          "public/css/styles.css": ["public/less/styles.less", "public/vendor/css/animate.css"]
        }
      }
    },
    browserify: {
      options: {
        noParse: ['public/vendor/js/superagent.js'],
        debug: true
      },
      dist: {
        files: {
          'public/js/ungit.js': ['public/source/main.js'],
          'public/js/devStyling.js': ['public/source/devStyling.js']
        }
      }
    },
    watch: {
      scripts: {
        files: ['public/source/**/*.js', 'source/**/*.js'],
        tasks: ['browserify'],
        options: {
          spawn: false,
        },
      },
      less: {
        files: ['public/less/*.less', 'public/styles/*.less'],
        tasks: ['less:production'],
        options: {
          spawn: false,
        },
      },
      templates: {
        files: ['public/templates/*'],
        tasks: ['templates'],
        options: {
          spawn: false,
        },
      },
    },
    lineending: {
      // Debian won't accept bin files with the wrong line ending
      production: {
        options: {
          eol: 'lf'
        },
        files: {
          './bin/ungit': ['./bin/ungit'],
          './bin/credentials-helper': ['./bin/credentials-helper']
        }
      },
    },
    release: {
      options: {
        commitMessage: 'Release <%= version %>',
      }
    },
    // Run mocha tests
    simplemocha: {
      options: {
        reporter: 'spec'
      },

      all: { src: 'test/*.js' }
    },
    // Plato code analysis
    plato: {
      all: {
        files: {
          'report': ['source/**/*.js', 'public/source/**/*.js'],
        }
      },
    },

    // Minify images (basically just lossless compression)
    imagemin: {
      default: {
        options: {
          optimizationLevel: 3
        },
        files: [{
          expand: true,
          cwd: 'assets/client/images/',
          src: ['**/*.png'],
          dest: 'public/images/'
        }]
      }
    },

    // Embed images in css
    imageEmbed: {
      default: {
        src: [ "public/css/styles.css" ],
        dest: "public/css/styles.css",
        options: {
          deleteAfterEncoding: false
        }
      }
    },
    jshint: {
      options: {
        undef: true, // check for usage of undefined variables
        '-W033': true, // ignore Missing semicolon
        '-W099': true, // ignore Mixed spaces and tabs
        '-W041': true, // ignore Use '===' to compare with '0'
        '-W065': true, // ignore Missing radix parameter
        '-W069': true, // ignore ['HEAD'] is better written in dot notation        
      },
      web: {
        options: {
          node: true,
          browser: true,
          globals: {
            'ungit': true,
            'io': true,
            'bugsense': true,
            'Keen': true
          }
        },
        src: ['public/source/**/*.js']
      },
      phantomjs: {
        options: {
          phantom: true,
          browser: true,
          globals: {
            '$': true,
          }
        },
        src: ['clicktests/**/*.js']
      },
      node: {
        options: {
          node: true
        },
        src: [
          'Gruntfile.js',
          'bin/*',
          'source/**/*.js',
        ]
      },
      mocha: {
        options: {
          node: true,
          globals: {
            'it': true,
            'describe': true,
            'before': true,
            'after': true,
            'window': true,
            'document': true,
            'navigator': true
          }
        },
        src: [
          'test/**/*.js',
        ]
      }
    }
  });

  grunt.registerTask('clicktest', 'Run clicktests.', function() {
    var done = this.async();
    grunt.log.writeln('Running clicktests...');
    var child = childProcess.execFile(phantomjs.path, [path.join(__dirname, 'clicktests', 'clicktests.js')]);
    child.stdout.on('data', function(data) {
      grunt.log.write(data);
    });
    child.stderr.on('data', function(data) {
      grunt.log.error(data);
    })
    child.on('exit', function(code) {
      done(code == 0);
    });
  });

  var templateIncludeRegexp = /<!-- ungit-import-template: "([^"^.]*).html" -->/gm;
  grunt.registerTask('templates', 'Compiling templates', function() {
    function compileTemplate(inFilename, outFilename) {
      var template = fs.readFileSync(inFilename, 'utf8');
      var newTemplate = template.replace(templateIncludeRegexp, function(match, templateName) {
        var templateFilename = path.join(path.dirname(inFilename), templateName + '.html');
        var res = 
          '<script type="text/html" id="' + templateName + '">\n' +
          fs.readFileSync(templateFilename, 'utf8') + '\n' +
          '</script>';
        return res;
      });
      fs.writeFileSync(outFilename, newTemplate);
    }
    compileTemplate('public/templates/index.html', 'public/index.html')
    compileTemplate('public/templates/devStyling.html', 'public/devStyling.html')
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-lineending');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-plato');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-image-embed');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task, builds everything needed
  grunt.registerTask('default', ['less:production', 'jshint', 'browserify', 'lineending:production', 'imagemin:default', 'imageEmbed:default', 'templates']);

  // Run tests
  grunt.registerTask('unittest', ['simplemocha']);
  grunt.registerTask('test', ['unittest', 'clicktest']);

  // Builds, and then creates a release (bump patch version, create a commit & tag, publish to npm)
  grunt.registerTask('publish', ['default', 'test', 'release:patch']);

  // Same as publish but for minor version
  grunt.registerTask('publishminor', ['default', 'test', 'release:minor']);

};
