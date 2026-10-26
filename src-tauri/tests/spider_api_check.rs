#[tokio::test]
async fn test_spider_api() {
    let mut website = spider::website::Website::new("https://arxiv.org");
    website.with_limit(2);
    website.with_depth(1);
    let mut rx = website.subscribe(16);
    let handle = tokio::spawn(async move {
        let _ = rx.recv().await;
    });
    let mut website2 = spider::website::Website::new("https://arxiv.org");
    let fut = website2.crawl();
    std::mem::drop(fut);
    handle.abort();
}
