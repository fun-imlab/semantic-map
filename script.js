// スクリプトの冒頭で変数を宣言し、デフォルトのソート順を設定
var currentSortOrder = "birthYear";
var timelineSeirekiData;  // timeline_seireki.json データを格納する変数を追加
var timelineAllData;
// JSON データの読み込み
Promise.all([
  d3.json("soukan_all.json"),
  d3.json("timeline_all_new.json"),
  //d3.json("konba-to.json"),
  //d3.json("timeline_seireki.json")
  d3.json("timeline_seirekiari.json")
]).then(function (data) {
  // 各JSONデータの取得
  var soukanData = data[0];
  //var timelineAllData = data[1];
  timelineAllData = data[1];
  timelineSeirekiData = data[2];  // timelineSeirekiData をグローバルに設定

  // 相関図の描画
  drawChart(soukanData, timelineAllData);
}).catch(function (error) {
  console.error("Error loading JSON data:", error);
});

// 年号不詳のカテゴリを作成
var unknownCategory = "年号不詳";

// D3.js を使用して相関図を描画
function drawChart(soukanData, timelineData) {
  var width = 800;
  var height = 600;

  var svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(d3.zoom().on("zoom", function (event) {
          svg.attr("transform", event.transform);
      }))
      .append("g");

  var tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

  var nodes = timelineData.map(function (d, i) {
      var birthYear = parseYear(d.生年);
      var deathYear = parseYear(d.没年);

      return {
          id: i,  // ノードの ID を追加
          name: d.名前,
          birthYear: birthYear,
          deathYear: deathYear,
          image : d.画像
      };
  });

  var links = [];

  // soukan_all.json のデータをもとにリンクを追加
soukanData.forEach(function (d, i) {
    var source = nodes.find(function (node) {
        return node.name === d.言葉1;
    });

    var target = nodes.find(function (node) {
        return node.name === d.名前1;
    });

    if (source && target) {
        // 既に同じソースとターゲットのリンクが存在するかチェック
        var existingLink = links.find(function (link) {
            return (link.source === source && link.target === target) || (link.source === target && link.target === source);
        });

        if (existingLink) {
            // 既に存在する場合はカウントを増やす
            existingLink.count++;
        } else {
            // 新しいリンクを追加
            links.push({
                id: "link" + i,
                source: source,
                target: target,
                count: 1,  // デフォルト値
                relation: d.カウント  // リンクに付与する "relation" は soukanData の値から取得
            });
        }
    }
});

  console.log(links); // デバッグ用に links 配列をコンソールに出力
  // リンクで繋がっていないノードを削除
  var connectedNodeNames = new Set(links.flatMap(link => [link.source.name, link.target.name]));
  nodes = nodes.filter(node => connectedNodeNames.has(node.name));

  // 初回描画時は生年順でソート
  nodes.sort(sortNodes);

  var simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-50))
      .force("link", d3.forceLink(links).distance(30))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(50)); // ノード同士の重なりを防ぐ

  var link = svg.selectAll(".link")
      .data(links)
      .enter().append("line")
      .attr("class", "link")
      .style("stroke", function (d) { return d.count > 1 ? "blue" : "black"; })  // リンクの色を青または黒に変更
      .style("stroke-width", 1);  // リンクの幅を1に変更

  // ノードの描画
  var node = svg.selectAll(".node")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", function (d) {
          return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", function (event, d) {
          tooltip.transition()
              .duration(200)
              .style("opacity", .9);
          tooltip.html("<strong>" + d.name + "</strong><br>生年: " + displayYear(d.birthYear) + "<br>没年: " + displayYear(d.deathYear))
              .style("left", (event.pageX + 5) + "px")
              .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function (d) {
          tooltip.transition()
              .duration(500)
              .style("opacity", 0);
      });

      // 四角形の描画
node.append("rect")
.attr("x", -22)  // 左右に余白を持たせる
.attr("y", -22)  // 上下に余白を持たせる
.attr("width", 44)  // 画像の幅 + 2 * 2
.attr("height", 44)  // 画像の高さ + 2 * 2
.style("fill", "transparent")
.style("stroke", "transparent")  // 枠の色
.style("stroke-width", 2);  // 枠の幅


  // 画像の描画
  node.append("image")
      .attr("xlink:href", function (d) {
          // ノードの画像があるかどうかを確認
          if (d.image) {
              // GitHub Pagesでの画像のパス
              return "image/images/" + d.image;
          } else {
              // 画像が指定されていない場合のデフォルト画像のパス
              return "image/images/images/unknown.jpg"; // デフォルト画像のパスを適切に指定してください
          }
      })
      .attr("x", -20)  // 画像の幅の半分だけ左にずらす
      .attr("y", -20)  // 画像の高さの半分だけ上にずらす
      .attr("width", 40)  // 画像の幅
      .attr("height", 40);  // 画像の高さ

      // ノードの検索処理
window.searchNodes = function () {
    var searchText = document.getElementById("searchInput").value.toLowerCase();

    svg.selectAll(".node")
        .select("rect")
        .style("stroke", function (d) {
            var isMatching = searchText.length > 0 && d.name.toLowerCase().includes(searchText);
            return isMatching ? "red" : "transparent";
        });
}

  var ticked = function () {
      link
          .attr("x1", function (d) { return calculateIntersection(d.source, d.target, "x"); })
          .attr("y1", function (d) { return calculateIntersection(d.source, d.target, "y"); })
          .attr("x2", function (d) { return calculateIntersection(d.target, d.source, "x"); })
          .attr("y2", function (d) { return calculateIntersection(d.target, d.source, "y"); });

      node
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
    });
  };

  simulation.on("tick", ticked);

  // ノードの境界とリンクの交点を計算
  function calculateIntersection(node1, node2, coord) {
      var dx = node2.x - node1.x;
      var dy = node2.y - node1.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var radius1 = 20; // ノードの半径
      var radius2 = 20; // ノードの半径

      var ratio = (distance - radius1) / distance;
      var x = node1.x + ratio * dx;
      var y = node1.y + ratio * dy;

      if (coord === "x") {
          return x;
      } else {
          return y;
      }
  }

  // タイムラインボタンがクリックされたときの処理
window.toggleTimeline = function () {
    if (simulation) {
        simulation.stop();
        svg.selectAll(".link").remove();
        svg.selectAll(".arrow").remove();
        svg.selectAll(".axis").remove();
        simulation = null;

        // 生年が数値でないか、18??のノードを年号不詳のカテゴリにまとめる
        nodes.forEach(function (d) {
            if (!isNumeric(d.birthYear) || d.birthYear === 18) {
                d.birthYear = unknownCategory;
            }
            if (!isNumeric(d.deathYear) || d.deathYear === 18) {
                d.deathYear = unknownCategory;
            }
        });

        // プルダウンで指定されたソート順でノードをソート
        nodes.sort(sortNodes);

        var xScale = d3.scaleLinear().domain([d3.min(nodes, d => d.birthYear), d3.max(nodes, d => d.birthYear)]).range([80, width - 80]);

        nodes.forEach(function (d, i) {
            d.x = xScale(d.birthYear);
            d.y = i * 40 + height / 4;  // 左から右下の方向に配置
        });

        // x 軸の描画
        var xAxis = d3.axisBottom().scale(xScale);

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0, 30)")  // 上に配置
            .call(xAxis);

        // ノードの再描画
        svg.selectAll(".node")
            .data(nodes)
            .transition()
            .duration(500)
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
            
    } else {
        // 相関図の再描画
        drawChart(soukanData, timelineData);
    }
};


  // ノードの詳細タイムラインの描画
function drawTimelineDetail(nodeData) {
  var birthYear = parseYear(nodeData.birthYear);
  var deathYear = parseYear(nodeData.deathYear);

  var timelineDetail = d3.select("#timelineDetail");
  timelineDetail.selectAll("*").remove(); // 既存の要素をクリア

  // 長方形の描画
  var rectWidth = 500;
  var rectHeight = 30;
  var rectColor = "steelblue";

  timelineDetail.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", rectWidth)
      .attr("height", rectHeight)
      .attr("class", "timelineRect")
      .style("fill", rectColor);

  // 始点と終点の数値を表示
  var textOffset = 5;
  var textHeight = rectHeight + 15; // 数値を表示する高さ

  timelineDetail.append("text")
      .attr("x", textOffset)
      .attr("y", textHeight)
      .attr("dy", "0.35em")
      .attr("class", "timelineText")
      .text(birthYear);

  timelineDetail.append("text")
      .attr("x", rectWidth - textOffset)
      .attr("y", textHeight)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("class", "timelineText")
      .text(deathYear);
}


  // ノードの詳細タイムラインと抽出された文の表示
svg.selectAll(".node")
.on("click", function (event, d) {
    displayNameSentences(d);
    drawTimelineDetail(d);
    displayExtractedSentences(d);
    toggleNodeDetail(d);
    drawRedLines(d);
   // 1. クリックされたノードに繋がるリンクを抽出
   var connectedLinks = links.filter(link =>
    link.source === d || link.target === d
);

// 2. クリックされたノードがソースノードであるリンクとターゲットノードであるリンクを取得
var sourceNodeLinks = connectedLinks.filter(link => link.source === d);
var targetNodeLinks = connectedLinks.filter(link => link.target === d);

// 3. すべてのリンクを元のスタイルに戻す
svg.selectAll(".link")
.style("stroke", function (link) {
    return link.count > 1 ? "blue" : "black";  // countが1より大きい場合は青色、それ以外は黒色
})
.style("stroke-width", 1);

// 4. クリックされたノードの他のターゲットノードであるリンクをハイライト表示
svg.selectAll(".link")
.filter(link => targetNodeLinks.includes(link))
.style("stroke", "red")
.style("stroke-width", 1);

// 5. ソースノードであるリンクのrelation値でハイライト表示
svg.selectAll(".link")
.filter(link => sourceNodeLinks.includes(link))
.style("stroke", "red")  // 例えば赤色でハイライト表示
.style("stroke-width", function (link) {
    // ハイライトの明るさをrelation値で変更
    return link.relation * 2;
});

// 6. 他のノードのハイライト解除
svg.selectAll(".node")
.select("rect")
.style("stroke", "transparent");

// 7. クリックされたノードをハイライト
d3.select(this)
.select("rect")
.style("stroke", "red");

});

// 追加: 赤い線がクリックされたときの処理
svg.selectAll(".redLine")
.on("click", function (event, d) {
    highlightExtractedSentences(d);
});

// ノードに関連する抽出された文を表示する関数
function displayNameSentences(nodeData) {
    var nameSentencesContainer = document.getElementById("nameSentence");
    nameSentencesContainer.innerHTML = "";
    
    // 該当する名前列を検索し、一致する行の"抽出された文"を表示
    timelineAllData.forEach(function (entry) {
        if (entry.名前 === nodeData.name) {
            var nameSentence = document.createElement("p");
            nameSentence.textContent = entry.名前;
            nameSentence.style.fontSize = "20px";  // フォントサイズを変更
            nameSentence.style.fontWeight = "bold";  // フォントの太さを変更
            nameSentencesContainer.appendChild(nameSentence);
        }
    });
    }

// ノードに関連する抽出された文を表示する関数
function displayExtractedSentences(nodeData) {
var extractedSentencesContainer = document.getElementById("extractedSentences");
extractedSentencesContainer.innerHTML = "";

// 該当する名前列を検索し、一致する行の"抽出された文"を表示
timelineSeirekiData.forEach(function (entry) {
    if (entry.名前 === nodeData.name) {
        var extractedSentence = document.createElement("p");
        extractedSentence.textContent = entry.抽出された文;
        extractedSentencesContainer.appendChild(extractedSentence);
    }
});
}
// ノードがクリックされたときの処理を追加
function toggleNodeDetail(nodeData) {
    var urlSentenceContainer = document.getElementById("urlSentence");
    urlSentenceContainer.innerHTML = "";  // 内容をクリア

    // timeline_all_new.json から該当する名前のエントリを検索
    var matchingEntry = timelineAllData.find(function (entry) {
        return entry.名前 === nodeData.name;
    });

    if (matchingEntry) {
        // URLがあれば表示
        if (matchingEntry.URL) {
            var urlLink = document.createElement("a");
            urlLink.href = matchingEntry.URL;
            urlLink.target = "_blank";  // 新しいタブで開く
            urlLink.textContent = "元のサイト";
            urlSentenceContainer.appendChild(urlLink);
        }

        // URL_2があれば表示
        if (matchingEntry.URL_2) {
            var url2Link = document.createElement("a");
            url2Link.href = matchingEntry.URL_2;
            url2Link.target = "_blank";  // 新しいタブで開く
            url2Link.textContent = "元のサイト(後号）";
            urlSentenceContainer.appendChild(url2Link);
        }
    }
};

// 追加: 赤い線を引く関数
function drawRedLines(nodeData) {
  var extractedSentencesContainer = document.getElementById("extractedSentences");

  // 該当する名前列を検索し、一致する行の"西暦"の数値を取得
  var matchingYears = timelineSeirekiData
      .filter(function (entry) {
          return entry.名前 === nodeData.name;
      })
      .map(function (entry) {
          return parseInt(entry.西暦, 10);
      });

  // 赤い線を引く
  var svgDetail = d3.select("#timelineDetail");
  svgDetail.selectAll(".redLine").remove(); // 既存の赤い線を削除

  matchingYears.forEach(function (year) {
      var birthYear = parseYear(nodeData.birthYear);
      var deathYear = parseYear(nodeData.deathYear);

      var relativePosition = (year - birthYear) / (deathYear - birthYear);
      var xScaleDetail = d3.scaleLinear().domain([0, 1]).range([0, 500]);
      var rectHeight = 30; // 長方形の高さ

      svgDetail.append("line")
          .attr("class", "redLine")
          .attr("x1", xScaleDetail(relativePosition))
          .attr("y1", rectHeight)
          .attr("x2", xScaleDetail(relativePosition))
          .attr("y2", 0)
          .style("stroke", "red")
          .style("stroke-width", 5);
  });
}


// 追加: 赤い線がクリックされたときに抽出された文を青色で強調表示
// 追加: 赤い線がクリックされたときに抽出された文を青色で強調表示
function highlightExtractedSentences(year) {
  var extractedSentencesContainer = document.getElementById("extractedSentences");

  // すべての抽出された文の要素を取得
  var allEntries = timelineSeirekiData.filter(function (entry) {
      return parseInt(entry.西暦, 10) === year;
  });

  // すべての抽出された文をリセットして初期化
  extractedSentencesContainer.innerHTML = "";

  // 青い背景のスタイルで抽出された文を表示
  allEntries.forEach(function (entry) {
      var extractedSentence = document.createElement("div");
      extractedSentence.textContent = entry.抽出された文;
      extractedSentence.style.backgroundColor = "blue";  // 青い背景
      extractedSentence.style.color = "white";  // 白い文字
      extractedSentencesContainer.appendChild(extractedSentence);
  });
}




// プルダウンの変更時の処理
window.changeSortOrder = function () {
    // プルダウンで指定されたソート順を更新
    currentSortOrder = document.getElementById("sortSelect").value;

    // 生年が数値でないか、18??のノードを年号不詳のカテゴリにまとめる
    nodes.forEach(function (d) {
        if (!isNumeric(d.birthYear) || d.birthYear === 18) {
            d.birthYear = unknownCategory;
        }
        if (!isNumeric(d.deathYear) || d.deathYear === 18) {
            d.deathYear = unknownCategory;
        }
    });

    // プルダウンで指定されたソート順でノードをソート
    nodes.sort(sortNodes);

    // プルダウンが "番号順" の場合は、番号に基づいてノードを並び替え
    if (currentSortOrder === "number") {
        nodes.sort((a, b) => a.id - b.id);
    }

    var xScale = d3.scaleLinear().domain([d3.min(nodes, d => d.birthYear), d3.max(nodes, d => d.birthYear)]).range([80, width - 80]);

    nodes.forEach(function (d, i) {
        d.x = xScale(d.birthYear);
        d.y = i * 40 + height / 4;  // 左から右下の方向に配置
    });

    // x 軸の描画
    var xAxis = d3.axisBottom().scale(xScale);

    svg.selectAll(".axis").remove();  // 既存の x 軸を削除

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, 30)")  // 上に配置
        .call(xAxis);

    // ノードの再描画
    svg.selectAll(".node")
        .data(nodes)
        .transition()
        .duration(500)
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
};


// 年号を正しく表示するための関数
function displayYear(year) {
  return year === unknownCategory ? "年号不詳" : year;
}

// 年号を正しくパースするための関数
function parseYear(rawYear) {
  if (rawYear === "年号不詳" || isNaN(rawYear)) {
      return unknownCategory;
  }
  return parseInt(rawYear, 10);
}

// 数値かどうかを判定する関数
function isNumeric(value) {
  return !isNaN(value) && isFinite(value);
}

// ノードのソートを行う関数
function sortNodes(a, b) {
  if (a[currentSortOrder] === unknownCategory) {
      return 1;
  } else if (b[currentSortOrder] === unknownCategory) {
      return -1;
  } else {
      return a[currentSortOrder] - b[currentSortOrder];
  }
}
}